"""API views for orders app."""
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import (
    IsComercial,
    IsFiscal,
    IsLogistics,
    IsSystemAdmin,
)
from apps.core.models import TerminalDestination, TransshipmentLocation

from .models import LoadingOrder, SalesOrder
from .serializers import LoadingOrderSerializer, SalesOrderSerializer


INCREASE_BALANCE_THRESHOLD_KG = Decimal('55000')


def _to_decimal(value, field_name):
    if value in (None, ''):
        raise ValueError(f'{field_name} é obrigatório.')
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError) as exc:
        raise ValueError(f'{field_name} inválido.') from exc


class SalesOrderViewSet(viewsets.ModelViewSet):
    """Read-mostly access to Sales Orders (OVs).

    Writes (update for manual fallback / alter OV) are restricted to
    Logistics or Admin.
    """

    queryset = SalesOrder.objects.select_related(
        'managed_lot__base_lot',
        'transshipment_location',
        'terminal_destination',
        'billing_branch',
        'nf_future_delivery',
    ).prefetch_related('loading_orders')
    serializer_class = SalesOrderSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'ov_number',
        'ov_solicitation_number',
        'managed_lot__base_lot__lot_number',
        'billing_producer_name',
    ]
    ordering_fields = ['order_index', 'created_at', 'ov_status']
    ordering = ['managed_lot', 'order_index']

    def get_permissions(self):
        if self.action in {'list', 'retrieve'}:
            classes = [
                IsAuthenticated,
                IsComercial | IsLogistics | IsFiscal | IsSystemAdmin,
            ]
        else:
            classes = [IsAuthenticated, IsLogistics | IsSystemAdmin]
        return [cls() for cls in classes]

    def get_queryset(self):
        qs = super().get_queryset()
        managed_lot = self.request.query_params.get('managed_lot')
        if managed_lot:
            qs = qs.filter(managed_lot_id=managed_lot)
        ov_status = self.request.query_params.get('ov_status')
        if ov_status:
            qs = qs.filter(ov_status=ov_status)
        rpa_status = self.request.query_params.get('rpa_status')
        if rpa_status:
            qs = qs.filter(rpa_status=rpa_status)
        has_rfl = self.request.query_params.get('has_rfl')
        if has_rfl == 'true':
            qs = qs.filter(rfl_value_kg__gt=0)
        elif has_rfl == 'false':
            qs = qs.filter(rfl_value_kg=0)
        product = self.request.query_params.get('product')
        if product:
            qs = qs.filter(managed_lot__base_lot__product__icontains=product)
        cpf_cnpj = self.request.query_params.get('cpf_cnpj')
        if cpf_cnpj:
            qs = qs.filter(managed_lot__base_lot__cpf_cnpj__icontains=cpf_cnpj)
        created_after = self.request.query_params.get('created_after')
        if created_after:
            qs = qs.filter(created_at__gte=created_after)
        created_before = self.request.query_params.get('created_before')
        if created_before:
            qs = qs.filter(created_at__lte=created_before)
        return qs

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def alter(self, request, pk=None):
        """Invalidate the current OV and create a revised copy with updated logistics data.

        The old OV is set to INVALIDATED (not deleted) so the RPA can still read it.
        Use ``original_order`` on the new OV to trace the full revision chain.

        Payload:
            transshipment_location:    UUID | null
            terminal_destination:      UUID (required)
            rfl_value_kg:              decimal
            freight_value:             decimal
            billing_producer_name:     str
            client_state_registration: str (optional)
            keep_loading_order_ids:    list[UUID]   — OCs to carry over to the new OV
        """
        from .services import revise_sales_order

        ov = self.get_object()
        if ov.ov_status in (SalesOrder.Status.CLOSED, SalesOrder.Status.INVALIDATED):
            return Response(
                {'detail': f'Esta OV está "{ov.get_ov_status_display()}" e não pode ser revisada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data
        try:
            rfl = _to_decimal(data.get('rfl_value_kg'), 'rfl_value_kg')
            freight = _to_decimal(data.get('freight_value'), 'freight_value')
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        terminal_id = data.get('terminal_destination')
        if not terminal_id:
            return Response(
                {'detail': 'terminal_destination é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            terminal = TerminalDestination.objects.get(pk=terminal_id)
        except TerminalDestination.DoesNotExist:
            return Response(
                {'detail': 'Terminal destino não encontrado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        transshipment = None
        transshipment_id = data.get('transshipment_location')
        if transshipment_id:
            try:
                transshipment = TransshipmentLocation.objects.get(pk=transshipment_id)
            except TransshipmentLocation.DoesNotExist:
                return Response(
                    {'detail': 'Local de transbordo não encontrado.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        keep_ids = set(data.get('keep_loading_order_ids') or [])
        changes = {
            'transshipment_location': transshipment,
            'terminal_destination': terminal,
            'rfl_value_kg': rfl,
            'freight_value': freight,
            'billing_producer_name': (
                data.get('billing_producer_name') or ov.billing_producer_name
            ),
            'client_state_registration': (
                data.get('client_state_registration') or ov.client_state_registration
            ),
        }

        try:
            new_ov = revise_sales_order(
                ov,
                changes=changes,
                user=request.user if request.user.is_authenticated else None,
                keep_loading_order_ids=keep_ids,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(self.get_serializer(new_ov).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='increase-balance')
    def increase_balance(self, request, pk=None):
        """Increase the OV balance. Only allowed when current balance < 55,000 kg and no NF EF linked."""
        ov = self.get_object()
        if ov.nf_future_delivery_id is not None:
            return Response(
                {'detail': 'OV vinculada a NF Entrega Futura não pode ter saldo aumentado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if ov.balance_kg >= INCREASE_BALANCE_THRESHOLD_KG:
            return Response(
                {'detail': 'Saldo atual acima de 55.000 kg — aumento não permitido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            added = _to_decimal(request.data.get('added_kg'), 'added_kg')
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if added <= 0:
            return Response(
                {'detail': 'added_kg deve ser maior que zero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ov.total_quantity_kg = ov.total_quantity_kg + added
        ov.balance_kg = ov.balance_kg + added
        ov.rpa_status = SalesOrder.RpaStatus.AWAITING_OV_QUANTITY_UPDATE
        ov.save(update_fields=[
            'total_quantity_kg', 'balance_kg', 'rpa_status', 'updated_at',
        ])
        return Response(self.get_serializer(ov).data)

    @action(detail=False, methods=['post'], url_path='bulk-rfl')
    def bulk_rfl(self, request):
        """Create a new OV revision with updated rfl_value_kg for each eligible OV."""
        from .services import revise_sales_order
        ids = request.data.get('ids') or []
        if not isinstance(ids, list) or not ids:
            return Response(
                {'detail': 'ids deve ser uma lista não vazia.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            rfl = _to_decimal(request.data.get('rfl_value_kg'), 'rfl_value_kg')
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        ovs = SalesOrder.objects.filter(pk__in=ids).exclude(
            ov_status__in=[SalesOrder.Status.INVALIDATED, SalesOrder.Status.CLOSED]
        )
        user = request.user if request.user.is_authenticated else None
        revised = 0
        errors = []
        for ov in ovs:
            try:
                revise_sales_order(ov, changes={'rfl_value_kg': rfl}, user=user)
                revised += 1
            except ValueError as exc:
                errors.append({'id': str(ov.id), 'detail': str(exc)})
        return Response({'revised': revised, 'errors': errors})

    @action(detail=False, methods=['post'], url_path='register-manual')
    def register_manual(self, request):
        """Register an OV that already exists in SAP (manual fallback).

        Use when the RPA cannot be used for some reason and the user has
        created the OV directly in SAP. Body:
        ``{"managed_lot": "<uuid>", "ov_number": "...", "total_quantity_kg": "...",
          "creation_event_datetime"?: "..."}``

        Blocks if there is an active (non-errored, non-rejected) RPA-created OV
        for the same lot.
        """
        from apps.contracts.models import ContractManagedLot

        managed_lot_id = request.data.get('managed_lot')
        ov_number = (request.data.get('ov_number') or '').strip()
        if not managed_lot_id:
            return Response(
                {'detail': 'managed_lot é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ov_number:
            return Response(
                {'detail': 'ov_number é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            managed_lot = ContractManagedLot.objects.get(pk=managed_lot_id)
        except ContractManagedLot.DoesNotExist:
            return Response(
                {'detail': 'Lote não encontrado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            qty = _to_decimal(request.data.get('total_quantity_kg'), 'total_quantity_kg')
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if qty <= 0:
            return Response(
                {'detail': 'total_quantity_kg deve ser maior que zero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Block if there's an active RPA-created OV for the same lot.
        active_rpa_statuses = {
            SalesOrder.RpaStatus.AWAITING_OV_CREATION,
            SalesOrder.RpaStatus.EXECUTING,
            SalesOrder.RpaStatus.AWAITING_APPROVAL,
            SalesOrder.RpaStatus.COMPLETED,
        }
        blocking_qs = SalesOrder.objects.filter(
            managed_lot=managed_lot,
            manually_created=False,
            rpa_status__in=active_rpa_statuses,
        )
        if blocking_qs.exists():
            return Response(
                {
                    'detail': (
                        'Existe OV ativa criada via RPA para este lote. '
                        'Aguarde o encerramento ou cancele-a antes de registrar '
                        'uma OV manualmente.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if SalesOrder.objects.filter(ov_number=ov_number).exists():
            return Response(
                {'detail': f'Já existe uma OV com o número "{ov_number}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        next_order_index = (
            SalesOrder.objects.filter(managed_lot=managed_lot).count() + 1
        )
        ov = SalesOrder.objects.create(
            managed_lot=managed_lot,
            ov_number=ov_number,
            total_quantity_kg=qty,
            balance_kg=qty,
            delivered_quantity_kg=0,
            ov_status=SalesOrder.Status.IN_PROGRESS,
            rpa_status=SalesOrder.RpaStatus.NOT_APPLICABLE,
            manually_created=True,
            order_index=next_order_index,
            billing_producer_name=managed_lot.billing_producer_name,
            client_state_registration=managed_lot.client_state_registration,
        )
        return Response(
            self.get_serializer(ov).data, status=status.HTTP_201_CREATED
        )


class LoadingOrderViewSet(viewsets.ModelViewSet):
    queryset = LoadingOrder.objects.select_related('sales_order')
    serializer_class = LoadingOrderSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['oc_number', 'plate']
    ordering_fields = ['created_at', 'expires_at']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in {'list', 'retrieve'}:
            classes = [
                IsAuthenticated,
                IsComercial | IsLogistics | IsFiscal | IsSystemAdmin,
            ]
        else:
            classes = [IsAuthenticated, IsLogistics | IsSystemAdmin]
        return [cls() for cls in classes]

    def get_queryset(self):
        qs = super().get_queryset()
        sales_order = self.request.query_params.get('sales_order')
        if sales_order:
            qs = qs.filter(sales_order_id=sales_order)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs
