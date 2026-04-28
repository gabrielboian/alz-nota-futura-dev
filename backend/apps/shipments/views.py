"""API views for shipments app."""
from django.db import transaction
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import IsComercial, IsLogistics, IsSystemAdmin
from apps.contracts.models import ContractManagedLot
from apps.invoices.models import NFFutureDelivery
from apps.orders.models import SalesOrder

from .models import ShipmentRequest
from .serializers import ShipmentRequestSerializer


class ShipmentRequestViewSet(viewsets.ModelViewSet):
    """CRUD + approve/reject actions for shipment requests.

    Role-based authorization:
    - create: COMERCIAL (or ADMIN)
    - approve / reject: LOGISTICS (or ADMIN)
    - list / retrieve: COMERCIAL, LOGISTICS or ADMIN
    - update / partial_update / destroy: ADMIN only
    """

    queryset = ShipmentRequest.objects.select_related(
        'managed_lot__base_lot', 'requested_by', 'approved_by'
    )
    serializer_class = ShipmentRequestSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'managed_lot__base_lot__lot_number',
        'managed_lot__base_lot__producer_name',
        'desk_manager_ticket_id',
    ]
    ordering_fields = ['requested_at', 'approved_at', 'status']
    ordering = ['-requested_at']

    def get_permissions(self):
        if self.action == 'create':
            classes = [IsAuthenticated, IsComercial | IsSystemAdmin]
        elif self.action in {'approve', 'reject'}:
            classes = [IsAuthenticated, IsLogistics | IsSystemAdmin]
        elif self.action in {'list', 'retrieve'}:
            classes = [IsAuthenticated, IsComercial | IsLogistics | IsSystemAdmin]
        else:
            classes = [IsAuthenticated, IsSystemAdmin]
        return [cls() for cls in classes]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def perform_create(self, serializer):
        shipment = serializer.save(
            requested_by=self.request.user if self.request.user.is_authenticated else None,
        )
        # Move the managed lot to "awaiting approval" when a request is submitted.
        ContractManagedLot.objects.filter(pk=shipment.managed_lot_id).update(
            status=ContractManagedLot.Status.AWAITING_APPROVAL,
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        shipment = self.get_object()
        if shipment.status != ShipmentRequest.Status.PENDING:
            return Response(
                {'detail': 'Somente solicitações pendentes podem ser aprovadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user if request.user.is_authenticated else None
        now = timezone.now()

        with transaction.atomic():
            shipment.status = ShipmentRequest.Status.APPROVED
            shipment.approved_by = user
            shipment.approved_at = now
            shipment.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])

            lot = ContractManagedLot.objects.select_related('base_lot').get(pk=shipment.managed_lot_id)
            lot.status = ContractManagedLot.Status.IN_PROGRESS
            lot.shipment_released = True
            lot.released_at = now
            lot.released_by = user
            lot.save(update_fields=[
                'status', 'shipment_released', 'released_at', 'released_by', 'updated_at',
            ])

            # Create the first Sales Order row so the RPA can pick it up and
            # push it to SAP. Subsequent OVs are created via the "alter" /
            # "increase balance" actions.
            last_index = (
                SalesOrder.objects.filter(managed_lot_id=lot.pk)
                .order_by('-order_index')
                .values_list('order_index', flat=True)
                .first()
                or 0
            )
            # If an active NF Entrega Futura exists for this lot, link it and
            # draw the initial OV balance from the NF's remaining quantity so
            # we don't over-commit beyond what's been invoiced.
            nf_ef = (
                NFFutureDelivery.objects.filter(
                    lot_number=lot.base_lot.lot_number,
                    status=NFFutureDelivery.Status.IN_PROGRESS,
                )
                .order_by('-issue_date', '-created_at')
                .first()
            )
            if nf_ef is not None:
                total_qty = nf_ef.remaining_quantity_kg or nf_ef.quantity_kg
            else:
                total_qty = lot.base_lot.quantity_kg

            SalesOrder.objects.create(
                managed_lot=lot,
                order_index=last_index + 1,
                ov_status=SalesOrder.Status.PENDING,
                rpa_status=SalesOrder.RpaStatus.AWAITING_OV_CREATION,
                total_quantity_kg=total_qty,
                balance_kg=total_qty,
                freight_type_exit=lot.freight_type_exit,
                harvest_year=lot.base_lot.lot_number[:2] if lot.base_lot.lot_number else '',
                product_sap_code='',
                alternative_route=lot.route_info,
                corridor=lot.corridor,
                collection_point_code=lot.collection_point_code,
                freight_agent=lot.freight_agent,
                transshipment_location=lot.transshipment_location,
                terminal_destination=lot.terminal_destination,
                rfl_value_kg=lot.rfl_value_kg or 0,
                freight_value=lot.executed_freight_value or 0,
                billing_producer_name=lot.billing_producer_name,
                client_state_registration=lot.client_state_registration,
                nf_future_delivery=nf_ef,
            )

        return Response(self.get_serializer(shipment).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        shipment = self.get_object()
        if shipment.status != ShipmentRequest.Status.PENDING:
            return Response(
                {'detail': 'Somente solicitações pendentes podem ser rejeitadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        shipment.status = ShipmentRequest.Status.REJECTED
        shipment.approved_by = request.user if request.user.is_authenticated else None
        shipment.approved_at = timezone.now()
        shipment.notes = request.data.get('notes', shipment.notes)
        shipment.save(
            update_fields=['status', 'approved_by', 'approved_at', 'notes', 'updated_at']
        )

        ContractManagedLot.objects.filter(pk=shipment.managed_lot_id).update(
            status=ContractManagedLot.Status.AWAITING_REQUEST,
        )
        return Response(self.get_serializer(shipment).data)
