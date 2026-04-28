"""Serializers for orders app."""
from rest_framework import serializers

from .models import LoadingOrder, SalesOrder


class LoadingOrderSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = LoadingOrder
        fields = [
            'id',
            'oc_number',
            'sales_order',
            'plate',
            'weight_kg',
            'status',
            'status_display',
            'created_at',
            'expires_at',
        ]
        read_only_fields = ['id', 'created_at']


class SalesOrderSerializer(serializers.ModelSerializer):
    ov_status_display = serializers.CharField(
        source='get_ov_status_display', read_only=True
    )
    rpa_status_display = serializers.CharField(
        source='get_rpa_status_display', read_only=True
    )
    transshipment_location_name = serializers.CharField(
        source='transshipment_location.name', read_only=True, default=None
    )
    terminal_destination_name = serializers.CharField(
        source='terminal_destination.name', read_only=True, default=None
    )
    billing_branch_name = serializers.CharField(
        source='billing_branch.description', read_only=True, default=None
    )
    nf_future_delivery_number = serializers.CharField(
        source='nf_future_delivery.nf_number', read_only=True, default=None
    )
    lot_number = serializers.CharField(
        source='managed_lot.base_lot.lot_number', read_only=True, default=None
    )
    producer_name = serializers.CharField(
        source='managed_lot.base_lot.producer_name', read_only=True, default=None
    )
    cpf_cnpj = serializers.CharField(
        source='managed_lot.base_lot.cpf_cnpj', read_only=True, default=None
    )
    product = serializers.CharField(
        source='managed_lot.base_lot.product', read_only=True, default=None
    )
    freight_type_exit_name = serializers.CharField(
        source='freight_type_exit.name', read_only=True, default=None
    )
    corridor_name = serializers.CharField(
        source='corridor.name', read_only=True, default=None
    )
    is_invalidated = serializers.SerializerMethodField()
    loading_orders = LoadingOrderSerializer(many=True, read_only=True)

    def get_is_invalidated(self, obj) -> bool:
        return obj.ov_status == SalesOrder.Status.INVALIDATED

    class Meta:
        model = SalesOrder
        fields = [
            'id',
            'ov_number',
            'ov_solicitation_number',
            'managed_lot',
            'ov_status',
            'ov_status_display',
            'rpa_status',
            'rpa_status_display',
            'rpa_error_message',
            'rpa_last_attempt_at',
            'rpa_retry_count',
            'creation_event_datetime',
            'total_quantity_kg',
            'delivered_quantity_kg',
            'balance_kg',
            'cadence',
            'freight_type_exit',
            'freight_type_exit_name',
            'harvest_year',
            'product_sap_code',
            'alternative_route',
            'corridor',
            'corridor_name',
            'collection_point_code',
            'freight_agent',
            'billing_branch',
            'billing_branch_name',
            'transshipment_location',
            'transshipment_location_name',
            'terminal_destination',
            'terminal_destination_name',
            'rfl_value_kg',
            'freight_value',
            'billing_producer_name',
            'client_state_registration',
            'nf_future_delivery',
            'nf_future_delivery_number',
            'lot_number',
            'producer_name',
            'cpf_cnpj',
            'product',
            'order_index',
            'closed_at',
            'manually_created',
            'original_order',
            'invalidated_at',
            'invalidated_by',
            'is_invalidated',
            'created_at',
            'updated_at',
            'loading_orders',
        ]
        read_only_fields = [
            'id',
            'creation_event_datetime',
            'created_at',
            'updated_at',
            'rpa_last_attempt_at',
            'invalidated_at',
            'invalidated_by',
        ]
