"""Helpers to enqueue dispatch tasks."""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from .models import RpaDispatchTask


def enqueue_task(
    task_type: str,
    payload: dict[str, Any],
    related_object_type: str = '',
    related_object_id: Optional[UUID] = None,
) -> RpaDispatchTask:
    """Create a PENDING dispatch task for the RPA to pick up."""
    return RpaDispatchTask.objects.create(
        task_type=task_type,
        status=RpaDispatchTask.Status.PENDING,
        payload=payload or {},
        related_object_type=related_object_type,
        related_object_id=related_object_id,
    )
