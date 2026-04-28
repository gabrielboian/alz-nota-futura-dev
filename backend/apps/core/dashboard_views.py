"""Dashboard / KPI endpoints.

Returns aggregated counters that power the overview page. Read-only, scoped
to any authenticated internal user; the frontend narrows the view by role.
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


def _sum(qs, field: str) -> Decimal:
    value = qs.aggregate(v=Sum(field))['v']
    return value or Decimal('0')


class DashboardKPIView(APIView):
    """Aggregated KPIs for the overview page.

    GET /api/v1/dashboard/kpis/ → json with contract / OV / NF / shipment counters.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)
        last_30d = now - timedelta(days=30)

        # ---- Contracts / managed lots --------------------------------------
        managed = ContractManagedLot.objects.all()
        contracts_by_status = dict(
            managed.values_list('status').annotate(c=Count('id')).values_list('status', 'c')
        )
        contracts_total = managed.count()

        last_upload = ContractUpload.objects.order_by('-upload_date').first()
        last_upload_data = None
        if last_upload is not None:
            last_upload_data = {
                'id': str(last_upload.pk),
                'upload_date': last_upload.upload_date.isoformat(),
                'status': last_upload.status,
                'row_count': last_upload.row_count,
                'error_count': last_upload.error_count,
                'user_email': getattr(last_upload.user, 'email', None),
            }

        # ---- Sales orders (OVs) --------------------------------------------
        ovs = SalesOrder.objects.all()
        ov_by_status = dict(
            ovs.values_list('ov_status').annotate(c=Count('id')).values_list('ov_status', 'c')
        )
        ov_by_rpa_status = dict(
            ovs.values_list('rpa_status').annotate(c=Count('id')).values_list('rpa_status', 'c')
        )
        ov_rpa_errors = ovs.filter(rpa_status=SalesOrder.RpaStatus.ERROR).count()
        ov_awaiting_sap = ovs.filter(
            rpa_status__in=(
                SalesOrder.RpaStatus.AWAITING_OV_CREATION,
                SalesOrder.RpaStatus.EXECUTING,
                SalesOrder.RpaStatus.AWAITING_APPROVAL,
            )
        ).count()
        ov_open_balance_kg = _sum(
            ovs.exclude(ov_status=SalesOrder.Status.CLOSED), 'balance_kg'
        )
        ov_delivered_24h_kg = _sum(ovs.filter(updated_at__gte=last_24h), 'delivered_quantity_kg')

        # ---- NFs Entrega Futura --------------------------------------------
        nfs = NFFutureDelivery.objects.all()
        nfs_by_status = dict(
            nfs.values_list('status').annotate(c=Count('id')).values_list('status', 'c')
        )
        nf_in_progress = nfs.filter(status=NFFutureDelivery.Status.IN_PROGRESS)
        nf_total_quantity_kg = _sum(nfs, 'quantity_kg')
        nf_delivered_kg = _sum(nfs, 'delivered_quantity_kg')
        nf_remaining_kg = _sum(nfs, 'remaining_quantity_kg')
        nf_created_7d = nfs.filter(created_at__gte=last_7d).count()
        nf_without_ov = nf_in_progress.filter(sales_orders__isnull=True).count()

        # ---- Shipment requests ---------------------------------------------
        shipments = ShipmentRequest.objects.all()
        ship_by_status = dict(
            shipments.values_list('status').annotate(c=Count('id')).values_list('status', 'c')
        )
        ship_pending = shipments.filter(status=ShipmentRequest.Status.PENDING).count()
        ship_approved_30d = shipments.filter(
            status=ShipmentRequest.Status.APPROVED,
            approved_at__gte=last_30d,
        ).count()

        # ---- NF delivery progress percentage -------------------------------
        if nf_total_quantity_kg:
            nf_progress_pct = float(
                (nf_delivered_kg / nf_total_quantity_kg) * 100
            )
        else:
            nf_progress_pct = 0.0

        return Response({
            'generated_at': now.isoformat(),
            'contracts': {
                'total': contracts_total,
                'by_status': contracts_by_status,
                'last_upload': last_upload_data,
            },
            'sales_orders': {
                'total': ovs.count(),
                'by_status': ov_by_status,
                'by_rpa_status': ov_by_rpa_status,
                'rpa_errors': ov_rpa_errors,
                'awaiting_sap': ov_awaiting_sap,
                'open_balance_kg': str(ov_open_balance_kg),
                'delivered_last_24h_kg': str(ov_delivered_24h_kg),
            },
            'nf_future_delivery': {
                'total': nfs.count(),
                'by_status': nfs_by_status,
                'total_quantity_kg': str(nf_total_quantity_kg),
                'delivered_kg': str(nf_delivered_kg),
                'remaining_kg': str(nf_remaining_kg),
                'progress_pct': round(nf_progress_pct, 2),
                'created_last_7d': nf_created_7d,
                'in_progress_without_ov': nf_without_ov,
            },
            'shipments': {
                'total': shipments.count(),
                'by_status': ship_by_status,
                'pending': ship_pending,
                'approved_last_30d': ship_approved_30d,
            },
        })
