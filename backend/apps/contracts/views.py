"""API views for contracts app."""
from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import (
    IsComercial,
    IsFiscal,
    IsLogistics,
    IsSystemAdmin,
)

from .models import ContractBaseLot, ContractManagedLot, ContractUpload
from .parsers import parse_contract_xlsx
from .serializers import (
    ContractBaseLotSerializer,
    ContractManagedLotSerializer,
    ContractManagedLotUpdateSerializer,
    ContractUploadSerializer,
)


class ContractUploadViewSet(viewsets.ModelViewSet):
    """List + upload xlsx contract base.

    POST /api/v1/contracts/uploads/ with multipart `file` field.
    """
    queryset = ContractUpload.objects.all()
    serializer_class = ContractUploadSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {'detail': 'Arquivo "file" é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST
            )

        upload = ContractUpload.objects.create(
            file=file_obj,
            user=request.user if request.user.is_authenticated else None,
        )
        try:
            result = parse_contract_xlsx(upload.file.open('rb'), upload)
        except Exception as exc:  # noqa: BLE001
            upload.status = ContractUpload.Status.ERROR
            upload.observations = str(exc)
            upload.save(update_fields=['status', 'observations'])
            return Response(
                {'detail': f'Falha ao processar arquivo: {exc}', 'upload_id': str(upload.id)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(upload)
        return Response(
            {
                **serializer.data,
                'rows_created': result.rows_created,
                'rows_updated': result.rows_updated,
                'rows_errored': result.rows_errored,
                'errors_sample': result.errors[:10],
            },
            status=status.HTTP_201_CREATED,
        )


class ContractBaseLotViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ContractBaseLot.objects.all()
    serializer_class = ContractBaseLotSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['lot_number', 'producer_name', 'cpf_cnpj', 'product']
    ordering_fields = ['created_at', 'lot_number', 'quantity_kg', 'remaining_kg']
    ordering = ['-created_at']


class ContractManagedLotViewSet(viewsets.ModelViewSet):
    queryset = ContractManagedLot.objects.select_related(
        'base_lot', 'commercial_responsible', 'terminal_destination',
        'transshipment_location', 'participant',
    )
    serializer_class = ContractManagedLotSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['base_lot__lot_number', 'base_lot__producer_name',
                     'billing_producer_name', 'client_state_registration']
    ordering_fields = ['created_at', 'status', 'harvest_year']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'patch', 'put', 'head', 'options']

    def create(self, request, *args, **kwargs):
        """Disabled — managed lots are created automatically when a contract upload is parsed."""
        return Response(
            {'detail': 'Criação direta não permitida. Use o upload de contratos.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def get_serializer_class(self):
        if self.action in {'update', 'partial_update'}:
            return ContractManagedLotUpdateSerializer
        return ContractManagedLotSerializer

    def get_permissions(self):
        if self.action in {'list', 'retrieve'}:
            classes = [
                IsAuthenticated,
                IsComercial | IsLogistics | IsFiscal | IsSystemAdmin,
            ]
        elif self.action in {'update', 'partial_update'}:
            classes = [IsAuthenticated, IsComercial | IsLogistics | IsSystemAdmin]
        else:
            classes = [IsAuthenticated, IsSystemAdmin]
        return [cls() for cls in classes]

    def update(self, request, *args, **kwargs):
        """After writing portal fields, return the full read serializer payload."""
        response = super().update(request, *args, **kwargs)
        if response.status_code < 400:
            instance = self.get_object()
            response.data = ContractManagedLotSerializer(instance).data
        return response

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=['post'], url_path='split')
    def split(self, request, pk=None):
        """Desmembrar um lote em N novos lotes.

        Body: ``{"splits": [{"lot_number": "...", "quantity_kg": "...",
        "producer_name"?: "..."}, ...]}``

        Regras:
        - sum(splits.quantity_kg) deve ser igual ao ``remaining_kg`` do lote.
        - Bloqueia se houver OV criada em SAP (rpa_status em [executing, awaiting_approval, completed]).
        - Bloqueia se existir NF Entrega Futura vinculada (mesmo ``lot_number``).
        - Cria novos ContractBaseLot + ContractManagedLot (mesmo upload e dados do produtor)
          e cancela o lote original.
        """
        from apps.invoices.models import NFFutureDelivery
        from apps.orders.models import SalesOrder

        managed: ContractManagedLot = self.get_object()
        base = managed.base_lot

        splits = request.data.get('splits') or []
        if not isinstance(splits, list) or len(splits) < 2:
            return Response(
                {'detail': 'Informe ao menos 2 novos lotes em "splits".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reject if any SalesOrder has already been created in SAP.
        blocking_rpa = {
            SalesOrder.RpaStatus.EXECUTING,
            SalesOrder.RpaStatus.AWAITING_APPROVAL,
            SalesOrder.RpaStatus.COMPLETED,
        }
        if SalesOrder.objects.filter(managed_lot=managed, rpa_status__in=blocking_rpa).exists():
            return Response(
                {'detail': 'Lote possui OV já criada no SAP. Desmembramento bloqueado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reject if a mother NF exists for this lot.
        if NFFutureDelivery.objects.filter(lot_number=base.lot_number).exists():
            return Response(
                {
                    'detail': (
                        'Existe NF de Entrega Futura vinculada a este lote. '
                        'Desmembramento bloqueado.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate each split.
        try:
            parsed_splits = []
            total = Decimal('0')
            seen_numbers = set()
            for idx, row in enumerate(splits):
                if not isinstance(row, dict):
                    raise ValueError(f'splits[{idx}] inválido.')
                new_lot_number = (row.get('lot_number') or '').strip()
                if not new_lot_number:
                    raise ValueError(f'splits[{idx}].lot_number é obrigatório.')
                if new_lot_number in seen_numbers:
                    raise ValueError(f'lot_number "{new_lot_number}" duplicado em splits.')
                seen_numbers.add(new_lot_number)
                if ContractBaseLot.objects.filter(lot_number=new_lot_number).exists():
                    raise ValueError(f'lot_number "{new_lot_number}" já existe.')

                qty_raw = row.get('quantity_kg')
                try:
                    qty = Decimal(str(qty_raw))
                except (InvalidOperation, TypeError, ValueError) as exc:
                    raise ValueError(
                        f'splits[{idx}].quantity_kg inválido: {qty_raw}.'
                    ) from exc
                if qty <= 0:
                    raise ValueError(f'splits[{idx}].quantity_kg deve ser > 0.')
                total += qty
                parsed_splits.append({
                    'lot_number': new_lot_number,
                    'quantity_kg': qty,
                    'producer_name': (row.get('producer_name') or base.producer_name),
                })

            if total != base.remaining_kg:
                raise ValueError(
                    f'Soma das quantidades ({total}) difere do saldo do lote original '
                    f'({base.remaining_kg}).'
                )
        except ValueError as exc:
            return Response(
                {'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )

        # Copy-able fields from the original base lot.
        base_copy_fields = [
            'upload', 'cpf_cnpj', 'liquidity', 'branch_name', 'lot_type', 'product',
            'city', 'state_code', 'payment_date', 'price', 'freight_type',
            'freight_value', 'emits_re', 'purchase_desk_id', 'address_code',
            'product_type', 'unit_value', 'lot_date', 'dap', 'load_producer',
            'load_location', 'load_city', 'load_state', 'cpf_cnpj_load',
            'delivery_start_date', 'delivery_end_date', 'destination_branch',
            'currency',
        ]

        created_ids: list[str] = []
        with transaction.atomic():
            for item in parsed_splits:
                new_base = ContractBaseLot(
                    lot_number=item['lot_number'],
                    producer_name=item['producer_name'],
                    quantity_kg=item['quantity_kg'],
                    remaining_kg=item['quantity_kg'],
                    delivered_kg=Decimal('0'),
                    reversed_kg=Decimal('0'),
                    balance=item['quantity_kg'],
                )
                for field in base_copy_fields:
                    setattr(new_base, field, getattr(base, field))
                new_base.save()

                new_managed = ContractManagedLot.objects.create(
                    base_lot=new_base,
                    harvest_year=managed.harvest_year,
                    pickup_location=managed.pickup_location,
                    loading_site=managed.loading_site,
                    collection_point_code=managed.collection_point_code,
                    loading_state_registration=managed.loading_state_registration,
                    freight_type_exit=managed.freight_type_exit,
                    region=managed.region,
                    phone=managed.phone,
                    email=managed.email,
                    billing_producer_name=managed.billing_producer_name,
                    client_state_registration=managed.client_state_registration,
                    cnpj_billing=managed.cnpj_billing,
                    commercial_responsible=managed.commercial_responsible,
                    commercial_responsible_name=managed.commercial_responsible_name,
                    participant=managed.participant,
                    delivered_by_holder=managed.delivered_by_holder,
                    freight_agent=managed.freight_agent,
                )
                created_ids.append(str(new_managed.id))

            # Cancel the original lot so the saldo no longer appears open.
            managed.status = ContractManagedLot.Status.CANCELLED
            managed.save(update_fields=['status', 'updated_at'])
            base.remaining_kg = Decimal('0')
            base.balance = Decimal('0')
            base.save(update_fields=['remaining_kg', 'balance', 'updated_at'])

        return Response(
            {
                'original_managed_lot_id': str(managed.id),
                'original_status': managed.status,
                'created_managed_lot_ids': created_ids,
            },
            status=status.HTTP_201_CREATED,
        )
