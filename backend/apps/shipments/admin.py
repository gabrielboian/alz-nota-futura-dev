"""Unfold admin for shipments app."""
from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin

from .models import ShipmentRequest


class HistoryModelAdmin(SimpleHistoryAdmin, ModelAdmin):
    """Mixes django-simple-history's change-log view into Unfold admin."""
    pass


@admin.register(ShipmentRequest)
class ShipmentRequestAdmin(HistoryModelAdmin):
    list_display = (
        'id',
        'managed_lot',
        'status',
        'requested_by',
        'approved_by',
        'desk_manager_ticket_id',
        'requested_at',
    )
    list_filter = ('status',)
    search_fields = (
        'desk_manager_ticket_id',
        'managed_lot__base_lot__lot_number',
        'requested_by__email',
    )
    readonly_fields = ('requested_at', 'approved_at', 'created_at', 'updated_at')
    autocomplete_fields = ('managed_lot', 'requested_by', 'approved_by')
