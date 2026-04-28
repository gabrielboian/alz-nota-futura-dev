"""Serializers for shipments app."""
from rest_framework import serializers

from .models import ShipmentRequest


class ShipmentRequestSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lot_number = serializers.CharField(
        source='managed_lot.base_lot.lot_number', read_only=True
    )
    producer_name = serializers.CharField(
        source='managed_lot.base_lot.producer_name', read_only=True
    )
    requested_by_email = serializers.EmailField(
        source='requested_by.email', read_only=True
    )
    approved_by_email = serializers.EmailField(
        source='approved_by.email', read_only=True
    )

    class Meta:
        model = ShipmentRequest
        fields = [
            'id',
            'managed_lot',
            'lot_number',
            'producer_name',
            'requested_by',
            'requested_by_email',
            'approved_by',
            'approved_by_email',
            'status',
            'status_display',
            'desk_manager_ticket_id',
            'requested_at',
            'approved_at',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'requested_by',
            'approved_by',
            'desk_manager_ticket_id',
            'requested_at',
            'approved_at',
            'created_at',
            'updated_at',
        ]
