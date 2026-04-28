"""RPA (Desk Manager) callback endpoints.

These endpoints are called by the RPA bot running against SAP. They share
a single bearer secret configured as ``settings.RPA_API_TOKEN`` and sent
as the ``X-RPA-Token`` HTTP header. No JWT user context — RPA is a
machine identity.

State transitions implemented
-----------------------------
ack                -> rpa_status=EXECUTING, last_attempt_at=now, retry_count++
created            -> ov_number set; ov_status=IN_PROGRESS; rpa_status=COMPLETED
awaiting-approval  -> rpa_status=AWAITING_APPROVAL
rejected           -> rpa_status=REJECTED, rpa_error_message=<reason>
error              -> rpa_status=ERROR,    rpa_error_message=<msg>
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
        """Return OVs the RPA should act on (awaiting creation or retry on error)."""
        limit = min(int(request.query_params.get('limit', 50)), 200)
        qs = (
            SalesOrder.objects.filter(
                rpa_status__in=[
                    SalesOrder.RpaStatus.AWAITING_OV_CREATION,
                    SalesOrder.RpaStatus.ERROR,
                ],
            )
            .select_related(
                'managed_lot__base_lot',
                'billing_branch',
                'transshipment_location',
                'terminal_destination',
            )
            .order_by('rpa_last_attempt_at', 'created_at')[:limit]
        )
        serializer = self.get_serializer(qs, many=True)
        return Response({'count': len(serializer.data), 'results': serializer.data})

    # ------------------------------------------------------------------
    # State transitions
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def ack(self, request, pk=None):
        """RPA started working on the job."""
        ov = self.get_object()
        ov.rpa_status = SalesOrder.RpaStatus.EXECUTING
        ov.rpa_last_attempt_at = timezone.now()
        ov.rpa_retry_count = (ov.rpa_retry_count or 0) + 1
        ov.save(update_fields=[
            'rpa_status', 'rpa_last_attempt_at', 'rpa_retry_count', 'updated_at',
        ])
        _log_callback('ack', ov.id, {})
        return Response(self.get_serializer(ov).data)

    @action(detail=True, methods=['post'])
    def created(self, request, pk=None):
        """SAP confirmed OV creation.

        Body: ``{ ov_number: str (required), ov_solicitation_number?: str }``
        """
        ov_number = (request.data.get('ov_number') or '').strip()
        if not ov_number:
            return Response(
                {'detail': 'ov_number é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        solicitation = (request.data.get('ov_solicitation_number') or '').strip()

        ov = self.get_object()
        ov.ov_number = ov_number
        if solicitation:
            ov.ov_solicitation_number = solicitation
        ov.ov_status = SalesOrder.Status.IN_PROGRESS
        ov.rpa_status = SalesOrder.RpaStatus.COMPLETED
        ov.rpa_error_message = ''
        ov.save(update_fields=[
            'ov_number', 'ov_solicitation_number', 'ov_status', 'rpa_status',
            'rpa_error_message', 'updated_at',
        ])
        _log_callback('created', ov.id, {'ov_number': ov_number, 'solicitation': solicitation})
        return Response(self.get_serializer(ov).data)

    @action(detail=True, methods=['post'], url_path='awaiting-approval')
    def awaiting_approval(self, request, pk=None):
        ov = self.get_object()
        ov.rpa_status = SalesOrder.RpaStatus.AWAITING_APPROVAL
        solicitation = (request.data.get('ov_solicitation_number') or '').strip()
        fields = ['rpa_status', 'updated_at']
        if solicitation:
            ov.ov_solicitation_number = solicitation
            fields.append('ov_solicitation_number')
        ov.save(update_fields=fields)
        _log_callback('awaiting_approval', ov.id, {'solicitation': solicitation})
        return Response(self.get_serializer(ov).data)

    @action(detail=True, methods=['post'])
    def rejected(self, request, pk=None):
        """SAP rejected the OV. Body: ``{ reason: str }``."""
        reason = (request.data.get('reason') or '').strip()
        ov = self.get_object()
        ov.rpa_status = SalesOrder.RpaStatus.REJECTED
        ov.rpa_error_message = reason
        ov.save(update_fields=['rpa_status', 'rpa_error_message', 'updated_at'])
        _log_callback('rejected', ov.id, {'reason': reason})
        return Response(self.get_serializer(ov).data)

    @action(detail=True, methods=['post'])
    def error(self, request, pk=None):
        """RPA hit a generic error. Body: ``{ error_message: str }``."""
        message = (request.data.get('error_message') or '').strip()
        ov = self.get_object()
        ov.rpa_status = SalesOrder.RpaStatus.ERROR
        ov.rpa_error_message = message
        ov.rpa_last_attempt_at = timezone.now()
        ov.save(update_fields=[
            'rpa_status', 'rpa_error_message', 'rpa_last_attempt_at', 'updated_at',
        ])
        _log_callback('error', ov.id, {'error_message': message})
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
