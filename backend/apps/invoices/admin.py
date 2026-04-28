"""Unfold admin for invoices app."""
from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin

from .models import ChildNF, NFFutureDelivery, NFValidationError, NFXmlFile


class HistoryModelAdmin(SimpleHistoryAdmin, ModelAdmin):
    """Mixes django-simple-history's change-log view into Unfold admin."""
    pass


@admin.register(NFFutureDelivery)
class NFFutureDeliveryAdmin(HistoryModelAdmin):
    list_display = (
        'nf_number',
        'lot_number',
        'producer_name',
        'product',
        'quantity_kg',
        'delivered_quantity_kg',
        'remaining_quantity_kg',
        'status',
        'issue_date',
    )
    list_filter = ('status', 'product', 'harvest_year')
    search_fields = ('nf_number', 'nf_key', 'lot_number', 'producer_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(NFValidationError)
class NFValidationErrorAdmin(ModelAdmin):
    list_display = ('code', 'level', 'message_pt')
    list_filter = ('level',)
    search_fields = ('code', 'message_pt')


@admin.register(ChildNF)
class ChildNFAdmin(HistoryModelAdmin):
    list_display = (
        'nf_number',
        'mother_nf',
        'validation_level',
        'validation_status',
        'validation_error',
        'issue_date',
    )
    list_filter = ('validation_status', 'validation_level', 'has_correction_letter')
    search_fields = ('nf_number', 'nf_key', 'mother_nf__nf_number')
    readonly_fields = ('created_at', 'updated_at', 'validated_at')


@admin.register(NFXmlFile)
class NFXmlFileAdmin(ModelAdmin):
    list_display = ('kind', 'nf_number', 'nf_key', 'mother_nf', 'child_nf', 'source', 'created_at')
    list_filter = ('kind', 'source')
    search_fields = ('nf_number', 'nf_key', 'original_filename')
    readonly_fields = ('created_at', 'size_bytes')
    autocomplete_fields = ('mother_nf', 'child_nf', 'uploaded_by')
