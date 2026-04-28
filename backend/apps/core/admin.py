"""Unfold admin registrations for lookup tables."""
from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin

from .models import (
    Branch,
    CommercialResponsible,
    Corridor,
    Participant,
    Producer,
    TerminalDestination,
    TipoFreteSaida,
    TransshipmentLocation,
    Transportadora,
    TransportadoraALZT,
)


class HistoryModelAdmin(SimpleHistoryAdmin, ModelAdmin):
    """Mixes django-simple-history's change-log view into Unfold admin."""
    pass


@admin.register(Branch)
class BranchAdmin(HistoryModelAdmin):
    list_display = ('sap_code', 'description', 'state', 'type', 'cnpj', 'cif_transportadora')
    list_filter = ('type', 'state')
    search_fields = ('sap_code', 'description', 'cnpj')
    autocomplete_fields = ('cif_transportadora',)
    ordering = ('sap_code',)


@admin.register(TerminalDestination)
class TerminalDestinationAdmin(HistoryModelAdmin):
    list_display = ('name', 'is_transshipment', 'sap_client_code', 'sap_supplier_code', 'customs_facility_code')
    list_filter = ('is_transshipment',)
    search_fields = ('name', 'sap_client_code', 'sap_supplier_code')
    ordering = ('name',)


@admin.register(TransshipmentLocation)
class TransshipmentLocationAdmin(HistoryModelAdmin):
    list_display = ('name', 'branch')
    list_filter = ('branch',)
    search_fields = ('name',)
    autocomplete_fields = ('branch',)


@admin.register(Participant)
class ParticipantAdmin(HistoryModelAdmin):
    list_display = ('name', 'cnpj', 'inscricao_estadual', 'sap_code')
    search_fields = ('name', 'cnpj', 'inscricao_estadual', 'sap_code')
    ordering = ('name',)


@admin.register(CommercialResponsible)
class CommercialResponsibleAdmin(HistoryModelAdmin):
    list_display = ('name', 'state', 'branch', 'corporate_phone', 'email')
    list_filter = ('state', 'branch')
    search_fields = ('name', 'email', 'corporate_phone')
    autocomplete_fields = ('branch',)
    ordering = ('name',)


@admin.register(Corridor)
class CorridorAdmin(HistoryModelAdmin):
    list_display = ('code', 'name', 'description')
    search_fields = ('code', 'name')
    ordering = ('code',)


@admin.register(Producer)
class ProducerAdmin(HistoryModelAdmin):
    list_display = ('name', 'cpf_cnpj')
    search_fields = ('name', 'cpf_cnpj')
    ordering = ('name',)


@admin.register(TipoFreteSaida)
class TipoFreteSaidaAdmin(HistoryModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(Transportadora)
class TransportadoraAdmin(HistoryModelAdmin):
    list_display = ('code', 'name', 'state', 'cnpj', 'phone', 'email')
    search_fields = ('code', 'name', 'state', 'cnpj')
    ordering = ('code',)


@admin.register(TransportadoraALZT)
class TransportadoraALZTAdmin(HistoryModelAdmin):
    list_display = ('sap_code', 'description', 'state', 'cnpj', 'phone', 'email')
    search_fields = ('sap_code', 'description', 'state', 'cnpj')
    ordering = ('sap_code',)
