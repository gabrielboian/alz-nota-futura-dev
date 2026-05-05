"""RPA (Desk Manager) callback endpoints.

These endpoints are called by the RPA bot running against SAP. They share
a single bearer secret configured as ``settings.RPA_API_TOKEN`` and sent
as the ``X-RPA-Token`` HTTP header. No JWT user context — RPA is a
machine identity.

State transitions implemented
-----------------------------
ack                -> rpa_status=EXECUTING, last_attempt_at=now, retry_count++, external_rpa_id stored
created            -> ov_number set; ov_status=IN_PROGRESS; rpa_status=COMPLETED
error              -> rpa_status=ERROR, rpa_error_type, rpa_error_message, rpa_screenshot
closed             -> ov_status=CLOSED (SAP finished the OV)
billing            -> faturamento callback (Flow 12):
                      increments SalesOrder delivered / decrements balance and,
                      if linked, updates NFFutureDelivery balances

Loading orders
--------------
POST /rpa/loading-orders/            -> create OC (active)
POST /rpa/loading-orders/{id}/deactivate/ -> mark OC inactive
"""
from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.authentication.permissions import HasRPAToken
from apps.invoices.models import NFFutureDelivery

from .models import LoadingOrder, SalesOrder
from .serializers import LoadingOrderSerializer, SalesOrderSerializer

logger = logging.getLogger(__name__)


def _log_callback(event: str, ov_id: Any, payload: dict) -> None:
    logger.info('RPA callback event=%s sales_order=%s payload=%s', event, ov_id, payload)


class RPASalesOrderViewSet(viewsets.GenericViewSet):
    """RPA callbacks on Sales Orders (OVs)."""

    queryset = SalesOrder.objects.all()
    serializer_class = SalesOrderSerializer
    permission_classes = [HasRPAToken]
    authentication_classes: list = []  # bypass JWT auth for RPA

    # ------------------------------------------------------------------
    # Pending queue — RPA polls this to pick up jobs
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Return OVs the RPA should act on.

        Query params:
            status  – filter by a specific rpa_status value (optional).
                      Defaults to awaiting_ov_creation + awaiting_ov_quantity_update.
            limit   – max rows (default 50, max 200).
        """
        limit = min(int(request.query_params.get('limit', 50)), 200)
        status_param = request.query_params.get('status')

        if status_param:
            rpa_statuses = [status_param]
        else:
            rpa_statuses = [
                SalesOrder.RpaStatus.AWAITING_OV_CREATION,
                SalesOrder.RpaStatus.AWAITING_OV_QUANTITY_UPDATE,
            ]

        qs = (
            SalesOrder.objects.filter(rpa_status__in=rpa_statuses)
            .select_related(
                'managed_lot__base_lot',
                'billing_branch',
                'transshipment_location',
                'terminal_destination',
                'freight_type_exit',
                'corridor',
            )
            .order_by('rpa_status', 'created_at')[:limit]
        )
        serializer = self.get_serializer(qs, many=True)
        return Response({'count': len(serializer.data), 'results': serializer.data})

    # ------------------------------------------------------------------
    # State transitions
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def ack(self, request, pk=None):
        """RPA started working on the job.

        Body: ``{ external_rpa_id?: str }``
        """
        ov = self.get_object()
        ov.rpa_status = SalesOrder.RpaStatus.EXECUTING
        ov.rpa_last_attempt_at = timezone.now()
        ov.rpa_retry_count = (ov.rpa_retry_count or 0) + 1
        external_rpa_id = (request.data.get('external_rpa_id') or '').strip()
        if external_rpa_id:
            ov.external_rpa_id = external_rpa_id
        fields = ['rpa_status', 'rpa_last_attempt_at', 'rpa_retry_count', 'updated_at']
        if external_rpa_id:
            fields.append('external_rpa_id')
        ov.save(update_fields=fields)
        _log_callback('ack', ov.id, {'external_rpa_id': external_rpa_id})
        return Response(self.get_serializer(ov).data)

    @action(detail=True, methods=['post'])
    def created(self, request, pk=None):
        """SAP confirmed OV creation.

        Body: ``{ ov_number: str (required) }``
        """
        ov_number = (request.data.get('ov_number') or '').strip()
        if not ov_number:
            return Response(
                {'detail': 'ov_number é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ov = self.get_object()
        ov.ov_number = ov_number
        ov.ov_status = SalesOrder.Status.IN_PROGRESS
        ov.rpa_status = SalesOrder.RpaStatus.COMPLETED
        ov.rpa_error_message = ''
        ov.save(update_fields=[
            'ov_number', 'ov_status', 'rpa_status', 'rpa_error_message', 'updated_at',
        ])
        _log_callback('created', ov.id, {'ov_number': ov_number})
        return Response(self.get_serializer(ov).data)

    @action(detail=True, methods=['post'])
    def error(self, request, pk=None):
        """RPA hit an error.

        Body:
            error_type     (required) – ``business_exception`` or ``system_exception``
            error_message  (required) – human-readable message
            screenshot     (optional) – file upload saved to blob storage
        """
        error_type = (request.data.get('error_type') or '').strip()
        valid_types = {c[0] for c in SalesOrder.RpaErrorType.choices}
        if error_type not in valid_types:
            return Response(
                {'detail': f'error_type inválido. Use: {", ".join(sorted(valid_types))}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        message = (request.data.get('error_message') or '').strip()
        screenshot = request.FILES.get('screenshot')

        ov = self.get_object()
        ov.rpa_status = SalesOrder.RpaStatus.ERROR
        ov.rpa_error_type = error_type
        ov.rpa_error_message = message
        ov.rpa_last_attempt_at = timezone.now()
        fields = ['rpa_status', 'rpa_error_type', 'rpa_error_message', 'rpa_last_attempt_at', 'updated_at']
        if screenshot:
            ov.rpa_screenshot = screenshot
            fields.append('rpa_screenshot')
        ov.save(update_fields=fields)
        _log_callback('error', ov.id, {'error_type': error_type, 'error_message': message})
        return Response(self.get_serializer(ov).data)

    @action(detail=True, methods=['post'])
    def closed(self, request, pk=None):
        """SAP fully completed the OV — flip it to CLOSED."""
        ov = self.get_object()
        ov.ov_status = SalesOrder.Status.CLOSED
        ov.save(update_fields=['ov_status', 'updated_at'])
        _log_callback('closed', ov.id, {})
        return Response(self.get_serializer(ov).data)

    @action(detail=True, methods=['post'])
    def billing(self, request, pk=None):
        """Faturamento callback (docs/05-workflows Flow 12).

        The RPA issues a child NF in SAP and reports it here so the portal
        can debit the OV balance and keep the mother NF (NFFutureDelivery)
        in sync.

        Body:
            quantity_kg    (required, decimal kg billed on this event)
            nf_number?     (child NF number, logged only)
            nf_key?        (44-digit chave, logged only)
            unit_value?    (logged only)
            total_value?   (logged only)
            billing_date?  (ISO date, logged only)
        """
        qty_raw = request.data.get('quantity_kg')
        try:
            qty = Decimal(str(qty_raw)) if qty_raw not in (None, '') else None
        except (InvalidOperation, TypeError):
            qty = None
        if qty is None or qty <= 0:
            return Response(
                {'detail': 'quantity_kg é obrigatório e deve ser maior que zero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ov = self.get_object()
        mother: NFFutureDelivery | None = ov.nf_future_delivery

        with transaction.atomic():
            ov.delivered_quantity_kg = (ov.delivered_quantity_kg or Decimal('0')) + qty
            new_balance = (ov.balance_kg or Decimal('0')) - qty
            ov.balance_kg = new_balance if new_balance > 0 else Decimal('0')
            ov.save(update_fields=[
                'delivered_quantity_kg', 'balance_kg', 'updated_at',
            ])

            if mother is not None:
                mother.delivered_quantity_kg = (
                    mother.delivered_quantity_kg or Decimal('0')
                ) + qty
                remaining = (mother.quantity_kg or Decimal('0')) - mother.delivered_quantity_kg
                mother.remaining_quantity_kg = remaining if remaining > 0 else Decimal('0')
                fields = ['delivered_quantity_kg', 'remaining_quantity_kg', 'updated_at']
                if mother.remaining_quantity_kg == 0:
                    mother.status = NFFutureDelivery.Status.FINISHED
                    fields.append('status')
                mother.save(update_fields=fields)

        _log_callback('billing', ov.id, {
            'quantity_kg': str(qty),
            'nf_number': request.data.get('nf_number'),
            'nf_key': request.data.get('nf_key'),
            'unit_value': request.data.get('unit_value'),
            'total_value': request.data.get('total_value'),
            'billing_date': request.data.get('billing_date'),
            'mother_nf': str(mother.id) if mother else None,
        })
        return Response(self.get_serializer(ov).data)


class RPALoadingOrderViewSet(viewsets.GenericViewSet):
    """RPA callbacks on Loading Orders (OCs)."""

    queryset = LoadingOrder.objects.all()
    serializer_class = LoadingOrderSerializer
    permission_classes = [HasRPAToken]
    authentication_classes: list = []

    def create(self, request):
        """Create an OC from SAP data.

        Body: sales_order (UUID), oc_number, plate, weight_kg, expires_at?
        """
        sales_order_id = request.data.get('sales_order')
        oc_number = (request.data.get('oc_number') or '').strip()
        plate = (request.data.get('plate') or '').strip()
        weight_raw = request.data.get('weight_kg')
        expires_at = request.data.get('expires_at')

        if not sales_order_id or not oc_number:
            return Response(
                {'detail': 'sales_order e oc_number são obrigatórios.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            ov = SalesOrder.objects.get(pk=sales_order_id)
        except SalesOrder.DoesNotExist:
            return Response(
                {'detail': 'sales_order não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            weight = Decimal(str(weight_raw)) if weight_raw not in (None, '') else Decimal('0')
        except (InvalidOperation, TypeError):
            return Response(
                {'detail': 'weight_kg inválido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            oc = LoadingOrder.objects.create(
                sales_order=ov,
                oc_number=oc_number,
                plate=plate,
                weight_kg=weight,
                expires_at=expires_at or None,
                status=LoadingOrder.Status.ACTIVE,
            )
        _log_callback('oc_created', ov.id, {'oc_number': oc_number, 'plate': plate})
        return Response(
            self.get_serializer(oc).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        oc = self.get_object()
        oc.status = LoadingOrder.Status.INACTIVE
        oc.save(update_fields=['status'])
        _log_callback('oc_deactivated', oc.sales_order_id, {'oc_number': oc.oc_number})
        return Response(self.get_serializer(oc).data)
