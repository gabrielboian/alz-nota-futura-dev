"""Aggregated KPI endpoints for the portal home dashboard.

All queries run synchronously against the shared database. Results are
intentionally ungrouped on the wire — the frontend (`/overview`) composes
the cards and breakdown charts from the flat JSON.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.contracts.models import ContractManagedLot, ContractUpload
from apps.invoices.models import NFFutureDelivery
from apps.orders.models import SalesOrder
from apps.shipments.models import ShipmentRequest


def _count_by(model, field):
    rows = model.objects.values(field).annotate(n=Count('id'))
    return {r[field]: r['n'] for r in rows}


def _decimal_str(value) -> str:
    if value is None:
        return '0'
    if isinstance(value, Decimal):
        return format(value, 'f')
    return str(value)


class DashboardKPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)
        last_30d = now - timedelta(days=30)

        # ---- Contracts ----
        contracts_total = ContractManagedLot.objects.count()
        contracts_by_status = _count_by(ContractManagedLot, 'status')
        last_upload = (
            ContractUpload.objects.select_related('user')
            .order_by('-upload_date')
            .first()
        )
        last_upload_payload = None
        if last_upload is not None:
            last_upload_payload = {
                'id': str(last_upload.id),
                'upload_date': last_upload.upload_date.isoformat(),
                'status': last_upload.status,
                'row_count': last_upload.row_count,
                'error_count': last_upload.error_count,
                'user_email': last_upload.user.email if last_upload.user else None,
            }

        # ---- Sales orders ----
        so_total = SalesOrder.objects.count()
        so_by_status = _count_by(SalesOrder, 'ov_status')
        so_by_rpa_status = _count_by(SalesOrder, 'rpa_status')
        rpa_errors = SalesOrder.objects.filter(
            rpa_status__in=[
                SalesOrder.RpaStatus.ERROR,
            ]
        ).count()
        awaiting_sap = SalesOrder.objects.filter(
            rpa_status__in=[
                SalesOrder.RpaStatus.AWAITING_OV_CREATION,
                SalesOrder.RpaStatus.EXECUTING,
                SalesOrder.RpaStatus.AWAITING_OV_QUANTITY_UPDATE,
            ]
        ).count()
        open_balance_kg = SalesOrder.objects.exclude(
            ov_status=SalesOrder.Status.CLOSED
        ).aggregate(s=Sum('balance_kg'))['s']
        delivered_last_24h_kg = SalesOrder.objects.filter(
            updated_at__gte=last_24h
        ).aggregate(s=Sum('delivered_quantity_kg'))['s']

        # ---- NF Entrega Futura ----
        nf_total = NFFutureDelivery.objects.count()
        nf_by_status = _count_by(NFFutureDelivery, 'status')
        nf_agg = NFFutureDelivery.objects.aggregate(
            total=Sum('quantity_kg'),
            delivered=Sum('delivered_quantity_kg'),
            remaining=Sum('remaining_quantity_kg'),
        )
        nf_total_qty = nf_agg['total'] or Decimal('0')
        nf_delivered = nf_agg['delivered'] or Decimal('0')
        nf_remaining = nf_agg['remaining'] or Decimal('0')
        progress_pct = 0
        if nf_total_qty and nf_total_qty > 0:
            progress_pct = int((nf_delivered / nf_total_qty) * 100)
        nf_last_7d = NFFutureDelivery.objects.filter(
            created_at__gte=last_7d
        ).count()
        # NFs in progress with no linked SalesOrder
        in_progress_without_ov = (
            NFFutureDelivery.objects.filter(
                status=NFFutureDelivery.Status.IN_PROGRESS
            )
            .annotate(n=Count('salesorder'))
            .filter(n=0)
            .count()
        )

        # ---- Shipments ----
        ship_total = ShipmentRequest.objects.count()
        ship_by_status = _count_by(ShipmentRequest, 'status')
        ship_pending = ShipmentRequest.objects.filter(
            status=ShipmentRequest.Status.PENDING
        ).count()
        ship_approved_30d = ShipmentRequest.objects.filter(
            status=ShipmentRequest.Status.APPROVED,
            approved_at__gte=last_30d,
        ).count()

        return Response({
            'generated_at': now.isoformat(),
            'contracts': {
                'total': contracts_total,
                'by_status': contracts_by_status,
                'last_upload': last_upload_payload,
            },
            'sales_orders': {
                'total': so_total,
                'by_status': so_by_status,
                'by_rpa_status': so_by_rpa_status,
                'rpa_errors': rpa_errors,
                'awaiting_sap': awaiting_sap,
                'open_balance_kg': _decimal_str(open_balance_kg),
                'delivered_last_24h_kg': _decimal_str(delivered_last_24h_kg),
            },
            'nf_future_delivery': {
                'total': nf_total,
                'by_status': nf_by_status,
                'total_quantity_kg': _decimal_str(nf_total_qty),
                'delivered_kg': _decimal_str(nf_delivered),
                'remaining_kg': _decimal_str(nf_remaining),
                'progress_pct': progress_pct,
                'created_last_7d': nf_last_7d,
                'in_progress_without_ov': in_progress_without_ov,
            },
            'shipments': {
                'total': ship_total,
                'by_status': ship_by_status,
                'pending': ship_pending,
                'approved_last_30d': ship_approved_30d,
            },
        })
