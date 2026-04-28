from rest_framework import serializers

from .models import RpaDispatchTask


class RpaDispatchTaskSerializer(serializers.ModelSerializer):
    task_type_display = serializers.CharField(source='get_task_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    related_object_type_display = serializers.CharField(
        source='get_related_object_type_display', read_only=True
    )

    class Meta:
        model = RpaDispatchTask
        fields = [
            'id',
            'task_type',
            'task_type_display',
            'status',
            'status_display',
            'payload',
            'related_object_type',
            'related_object_type_display',
            'related_object_id',
            'external_reference',
            'error_message',
            'retry_count',
            'created_at',
            'last_attempt_at',
            'completed_at',
        ]
        read_only_fields = fields
