"""Unfold admin for orders app."""
from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin, TabularInline

from .models import LoadingOrder, SalesOrder


class HistoryModelAdmin(SimpleHistoryAdmin, ModelAdmin):
    """Mixes django-simple-history's change-log view into Unfold admin."""
    pass


class LoadingOrderInline(TabularInline):
    model = LoadingOrder
    extra = 0
    fields = ('oc_number', 'plate', 'weight_kg', 'status', 'expires_at')
    readonly_fields = ('created_at',)


@admin.register(SalesOrder)
class SalesOrderAdmin(HistoryModelAdmin):
    list_display = (
        'ov_number',
        'managed_lot',
        'order_index',
        'ov_status',
        'rpa_status',
        'freight_type_exit',
        'harvest_year',
        'total_quantity_kg',
        'delivered_quantity_kg',
        'balance_kg',
        'original_order',
        'created_at',
    )
    list_filter = ('ov_status', 'rpa_status', 'alternative_route')
    search_fields = (
        'ov_number',
        'ov_solicitation_number',
        'managed_lot__base_lot__lot_number',
        'billing_producer_name',
        'freight_agent',
    )
    autocomplete_fields = (
        'managed_lot',
        'billing_branch',
        'transshipment_location',
        'terminal_destination',
        'nf_future_delivery',
        'freight_type_exit',
        'corridor',
        'original_order',
    )
    readonly_fields = ('created_at', 'updated_at', 'creation_event_datetime', 'invalidated_at', 'invalidated_by')
    inlines = [LoadingOrderInline]


@admin.register(LoadingOrder)
class LoadingOrderAdmin(HistoryModelAdmin):
    list_display = ('oc_number', 'sales_order', 'plate', 'weight_kg', 'status', 'expires_at')
    list_filter = ('status',)
    search_fields = ('oc_number', 'plate', 'sales_order__ov_number')
    autocomplete_fields = ('sales_order',)
    readonly_fields = ('created_at',)
