"""Automatic task enqueueing on domain events."""
from __future__ import annotations

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.orders.models import SalesOrder

from .models import RpaDispatchTask
from .services import enqueue_task

_PREVIOUS_RPA_STATUS_ATTR = '_previous_rpa_status'
_TICKET_TRIGGER_STATUSES = {SalesOrder.RpaStatus.ERROR, SalesOrder.RpaStatus.REJECTED}


@receiver(pre_save, sender=SalesOrder)
def _capture_previous_rpa_status(sender, instance: SalesOrder, **kwargs):
    if not instance.pk:
        setattr(instance, _PREVIOUS_RPA_STATUS_ATTR, None)
        return
    try:
        old = SalesOrder.objects.only('rpa_status').get(pk=instance.pk)
        setattr(instance, _PREVIOUS_RPA_STATUS_ATTR, old.rpa_status)
    except SalesOrder.DoesNotExist:
        setattr(instance, _PREVIOUS_RPA_STATUS_ATTR, None)


@receiver(post_save, sender=SalesOrder)
def _enqueue_desk_manager_ticket_on_error(sender, instance: SalesOrder, created, **kwargs):
    """When an OV transitions into ERROR/REJECTED, open a Desk Manager ticket."""
    current = instance.rpa_status
    if current not in _TICKET_TRIGGER_STATUSES:
        return

    previous = getattr(instance, _PREVIOUS_RPA_STATUS_ATTR, None)
    # Only fire on actual transitions into the trigger states.
    if not created and previous == current:
        return

    # Avoid duplicate pending/in-progress tickets for the same OV+status.
    already = RpaDispatchTask.objects.filter(
        task_type=RpaDispatchTask.TaskType.DESK_MANAGER_TICKET,
        related_object_type=RpaDispatchTask.RelatedType.SALES_ORDER,
        related_object_id=instance.id,
        status__in=[RpaDispatchTask.Status.PENDING, RpaDispatchTask.Status.IN_PROGRESS],
    ).exists()
    if already:
        return

    enqueue_task(
        task_type=RpaDispatchTask.TaskType.DESK_MANAGER_TICKET,
        payload={
            'ov_id': str(instance.id),
            'ov_number': instance.ov_number or '',
            'rpa_status': current,
            'error_message': instance.rpa_error_message or '',
            'managed_lot_id': str(instance.managed_lot_id) if instance.managed_lot_id else None,
            'retry_count': instance.rpa_retry_count,
        },
        related_object_type=RpaDispatchTask.RelatedType.SALES_ORDER,
        related_object_id=instance.id,
    )
