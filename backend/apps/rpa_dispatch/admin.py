from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import RpaDispatchTask


@admin.register(RpaDispatchTask)
class RpaDispatchTaskAdmin(ModelAdmin):
    list_display = (
        'task_type',
        'status',
        'related_object_type',
        'related_object_id',
        'retry_count',
        'created_at',
        'last_attempt_at',
    )
    list_filter = ('task_type', 'status', 'related_object_type')
    search_fields = ('external_reference', 'error_message', 'related_object_id')
    readonly_fields = ('id', 'created_at', 'last_attempt_at', 'completed_at')
