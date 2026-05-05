"""Unfold admin for contracts app."""
from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin, TabularInline

from .models import ContractBaseLot, ContractManagedLot, ContractUpload


class HistoryModelAdmin(SimpleHistoryAdmin, ModelAdmin):
    """Mixes django-simple-history's change-log view into Unfold admin."""
    pass


class ContractBaseLotInline(TabularInline):
    model = ContractBaseLot
    extra = 0
    can_delete = False
    show_change_link = True
    fields = ('lot_number', 'producer_name', 'product', 'quantity_kg', 'remaining_kg')
    readonly_fields = fields


@admin.register(ContractUpload)
class ContractUploadAdmin(HistoryModelAdmin):
    list_display = ('upload_date', 'status', 'user', 'row_count', 'error_count')
    list_filter = ('status',)
    search_fields = ('user__email', 'observations')
    readonly_fields = ('upload_date', 'row_count', 'error_count')
    inlines = [ContractBaseLotInline]


@admin.register(ContractBaseLot)
class ContractBaseLotAdmin(HistoryModelAdmin):
    list_display = ('lot_number', 'producer_name', 'product', 'branch_name',
                    'quantity_kg', 'remaining_kg', 'freight_type')
    list_filter = ('freight_type', 'product', 'branch_name')
    search_fields = ('lot_number', 'producer_name', 'cpf_cnpj')
    autocomplete_fields = ('upload',)
    ordering = ('-created_at',)


@admin.register(ContractManagedLot)
class ContractManagedLotAdmin(HistoryModelAdmin):
    list_display = ('base_lot', 'status', 'shipment_released', 'harvest_year',
                    'commercial_responsible', 'terminal_destination')
    list_filter = ('status', 'shipment_released', 'has_transshipment', 'scale_over_25m')
    search_fields = ('base_lot__lot_number', 'base_lot__producer_name',
                     'billing_producer_name', 'client_state_registration')
    autocomplete_fields = ('base_lot', 'commercial_responsible',
                           'transshipment_location', 'terminal_destination', 'participant',
                           'released_by', 'billing_branch')
    readonly_fields = ('released_at',)
