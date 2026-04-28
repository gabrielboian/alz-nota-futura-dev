"""Admin registrations for fiscal app."""
from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin

from .models import FiscalInstruction


class HistoryModelAdmin(SimpleHistoryAdmin, ModelAdmin):
    """Mixes django-simple-history's change-log view into Unfold admin."""
    pass


@admin.register(FiscalInstruction)
class FiscalInstructionAdmin(HistoryModelAdmin):
    list_display = (
        'instruction_name',
        'branch',
        'harvest_year',
        'product',
        'person_type',
        'issuer_state',
        'has_nf_future_delivery',
        'has_pdf',
        'is_active',
    )
    list_filter = (
        'branch',
        'harvest_year',
        'product',
        'person_type',
        'issuer_state',
        'has_nf_future_delivery',
        'is_active',
    )
    search_fields = (
        'instruction_name',
        'product',
        'client_name',
        'destination',
    )
    autocomplete_fields = ('branch',)
    fieldsets = (
        (None, {
            'fields': (
                'instruction_name',
                'is_active',
            ),
        }),
        ('Critérios de lookup', {
            'fields': (
                'branch',
                'harvest_year',
                'product',
                'person_type',
                'issuer_state',
                'has_nf_future_delivery',
            ),
        }),
        ('Conteúdo', {
            'fields': (
                'instruction_text',
                'destination',
                'freight_value',
                'route_description',
                'client_name',
                'pdf_file',
            ),
        }),
    )

    @admin.display(boolean=True, description='PDF?')
    def has_pdf(self, obj):
        return bool(obj.pdf_file)
