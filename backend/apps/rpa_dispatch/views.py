"""Two viewsets sharing one model:

- ``RpaDispatchTaskBotViewSet``  — machine-to-machine, ``X-RPA-Token`` header.
- ``RpaDispatchTaskAdminViewSet`` — JWT, internal staff. Powers the reprocess UI.
"""
from __future__ import annotations

from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import HasRPAToken, IsInternalStaff

from .models import RpaDispatchTask
from .serializers import RpaDispatchTaskSerializer


# ---------------------------------------------------------------------------
# Bot-facing
# ---------------------------------------------------------------------------
class RpaDispatchTaskBotViewSet(viewsets.GenericViewSet):
    """Polled by the RPA bot to drain the task queue."""

    queryset = RpaDispatchTask.objects.all()
    serializer_class = RpaDispatchTaskSerializer
    permission_classes = [HasRPAToken]
    authentication_classes: list = []

    @action(detail=False, methods=['get'])
    def pending(self, request):
        task_type = request.query_params.get('task_type')
        limit = min(int(request.query_params.get('limit', 50)), 200)
        qs = RpaDispatchTask.objects.filter(status=RpaDispatchTask.Status.PENDING)
        if task_type:
            qs = qs.filter(task_type=task_type)
        qs = qs.order_by('last_attempt_at', 'created_at')[:limit]
        data = self.get_serializer(qs, many=True).data
        return Response({'count': len(data), 'results': data})

    @action(detail=True, methods=['post'])
    def ack(self, request, pk=None):
        task = self.get_object()
        task.status = RpaDispatchTask.Status.IN_PROGRESS
        task.last_attempt_at = timezone.now()
        task.retry_count = (task.retry_count or 0) + 1
        task.save(update_fields=['status', 'last_attempt_at', 'retry_count'])
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=['post'])
    def report(self, request, pk=None):
        """Final callback. Body: ``{status, external_reference?, error_message?}``."""
        new_status = (request.data.get('status') or '').strip()
        if new_status not in {RpaDispatchTask.Status.COMPLETED, RpaDispatchTask.Status.ERROR}:
            return Response(
                {'detail': 'status deve ser "completed" ou "error".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task = self.get_object()
        task.status = new_status
        task.external_reference = (request.data.get('external_reference') or '').strip()
        task.error_message = (request.data.get('error_message') or '').strip()
        task.last_attempt_at = timezone.now()
        if new_status == RpaDispatchTask.Status.COMPLETED:
            task.completed_at = timezone.now()
        task.save(update_fields=[
            'status', 'external_reference', 'error_message',
            'last_attempt_at', 'completed_at',
        ])
        return Response(self.get_serializer(task).data)


# ---------------------------------------------------------------------------
# Admin-facing (JWT) — powers the reprocess page
# ---------------------------------------------------------------------------
class RpaDispatchTaskAdminViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RpaDispatchTask.objects.all()
    serializer_class = RpaDispatchTaskSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['external_reference', 'error_message']
    ordering_fields = ['created_at', 'last_attempt_at', 'status', 'task_type']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        for field in ('status', 'task_type', 'related_object_type', 'related_object_id'):
            value = self.request.query_params.get(field)
            if value:
                qs = qs.filter(**{field: value})
        return qs

    @action(detail=True, methods=['post'])
    def requeue(self, request, pk=None):
        """Reset a task back to PENDING so the RPA picks it up again."""
        task = self.get_object()
        if task.status == RpaDispatchTask.Status.PENDING:
            return Response(self.get_serializer(task).data)
        task.status = RpaDispatchTask.Status.PENDING
        task.error_message = ''
        task.last_attempt_at = None
        task.completed_at = None
        task.save(update_fields=[
            'status', 'error_message', 'last_attempt_at', 'completed_at',
        ])
        return Response(self.get_serializer(task).data)

    @action(detail=False, methods=['post'])
    def bulk_requeue(self, request):
        ids = request.data.get('ids') or []
        if not isinstance(ids, list) or not ids:
            return Response(
                {'detail': 'ids deve ser uma lista não vazia.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        updated = RpaDispatchTask.objects.filter(pk__in=ids).exclude(
            status=RpaDispatchTask.Status.PENDING,
        ).update(
            status=RpaDispatchTask.Status.PENDING,
            error_message='',
            last_attempt_at=None,
            completed_at=None,
        )
        return Response({'updated': updated})
