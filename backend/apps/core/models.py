"""Lookup / reference-data models shared across domain apps.

Sources (from xlsx `Rascunho Banco de Dados - NF Entrega Futura.xlsx`):
- BD-Filiais        → Branch
- BD-Terminais Destino → TerminalDestination
- BD-Participantes  → Participant
- BD-Comercial Responsável → CommercialResponsible
- BD-Corredor       → Corridor
Transshipment locations have no reference sheet; they are maintained via admin.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.db.models.functions import Lower
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class TimestampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Branch(TimestampedModel):
    """ALZ branch / Filial (BD-Filiais)."""

    class BranchType(models.TextChoices):
        WAREHOUSE = 'warehouse', _('Armazém')
        OFFICE = 'office', _('Escritório')

    sap_code = models.CharField(_('Código Filial (SAP)'), max_length=10, unique=True)
    state = models.CharField(_('Estado (UF)'), max_length=2)
    cnpj = models.CharField('CNPJ', max_length=18)
    description = models.CharField(_('Descrição Filial'), max_length=200)
    type = models.CharField(
        _('Tipo'), max_length=20, choices=BranchType.choices, default=BranchType.WAREHOUSE
    )
    cif_transportadora = models.ForeignKey(
        'Transportadora',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cif_branches',
        verbose_name=_('Transportadora CIF'),
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Filial')
        verbose_name_plural = _('Filiais')
        ordering = ['sap_code']

    def __str__(self) -> str:
        return f'{self.sap_code} — {self.description}'


class TerminalDestination(TimestampedModel):
    """Terminal Destino (BD-Terminais Destino)."""

    name = models.CharField(_('Nome Terminal'), max_length=200, unique=True)
    is_transshipment = models.BooleanField(_('Local de transbordo?'), default=False)
    sap_client_code = models.CharField(_('Código SAP Cliente'), max_length=20, blank=True, default='')
    sap_supplier_code = models.CharField(_('Código SAP Fornecedor'), max_length=20, blank=True, default='')
    customs_facility_code = models.CharField(
        _('Código Recinto Alfandegado'), max_length=30, blank=True, default=''
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Terminal Destino')
        verbose_name_plural = _('Terminais Destino')
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class TransshipmentLocation(TimestampedModel):
    """Local de transbordo (no reference sheet — maintained via admin)."""

    name = models.CharField(_('Nome'), max_length=200, unique=True)
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='transshipment_locations'
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Local de Transbordo')
        verbose_name_plural = _('Locais de Transbordo')
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class Participant(TimestampedModel):
    """Participante (BD-Participantes)."""

    name = models.CharField(_('Nome Participante'), max_length=200)
    sap_code = models.CharField(_('Código SAP'), max_length=20, blank=True, default='')
    inscricao_estadual = models.CharField(_('Inscrição Estadual'), max_length=30, blank=True, default='')
    cnpj = models.CharField('CNPJ', max_length=18, blank=True, default='')

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Participante')
        verbose_name_plural = _('Participantes')
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['cnpj'], condition=~models.Q(cnpj=''), name='participant_unique_cnpj'
            ),
        ]

    def __str__(self) -> str:
        return self.name


class CommercialResponsible(TimestampedModel):
    """Comercial Responsável (BD-Comercial Responsável)."""

    name = models.CharField(_('Nome'), max_length=200)
    state = models.CharField(_('Estado (UF)'), max_length=2, blank=True, default='')
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='commercial_responsibles',
        verbose_name=_('Filial alocado'),
    )
    corporate_phone = models.CharField(_('Telefone Corporativo'), max_length=30, blank=True, default='')
    email = models.EmailField(_('E-mail'), blank=True, default='')

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Comercial Responsável')
        verbose_name_plural = _('Comerciais Responsáveis')
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class TipoFreteSaida(TimestampedModel):
    """Tipo de Frete Saída — lookup para o campo tipo_frete_saida no lote gerenciado."""

    name = models.CharField(_('Nome'), max_length=100, unique=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Tipo de Frete Saída')
        verbose_name_plural = _('Tipos de Frete Saída')
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class Corridor(TimestampedModel):
    """Corredor logístico (BD-Corredor)."""

    code = models.CharField(_('Código'), max_length=20, unique=True)
    name = models.CharField(_('Nome'), max_length=100)
    description = models.CharField(_('Descrição'), max_length=300, blank=True, default='')

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Corredor')
        verbose_name_plural = _('Corredores')
        ordering = ['code']

    def __str__(self) -> str:
        return f'{self.code} — {self.name}'


class Producer(TimestampedModel):
    """Produtor de faturamento.

    Cadastro alimentado on-the-fly: quando o usuário digita um nome novo no
    fluxo de solicitação de embarque, uma nova entrada é criada e passa a ser
    pesquisável nas próximas vezes.
    """

    name = models.CharField(_('Nome'), max_length=200)
    cpf_cnpj = models.CharField('CPF/CNPJ', max_length=20, blank=True, default='')

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Produtor')
        verbose_name_plural = _('Produtores')
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                Lower('name'), name='producer_unique_lower_name'
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Transportadora(TimestampedModel):
    """Third-party carrier (BD-Transportadoras sheet).

    Used to resolve the freight agent code:
    - CIF  → branch.cif_transportadora.code
    - FOB  → collection_point_code (no lookup needed)
    - CPT  → user selects from this table or TransportadoraALZT; can create on-the-fly
    """

    code = models.CharField(_('Código SAP Fornecedor'), max_length=20, unique=True)
    name = models.CharField(_('Nome Transportadora'), max_length=200)
    state = models.CharField(_('Estado (UF)'), max_length=2, blank=True, default='')
    cnpj = models.CharField('CNPJ', max_length=18, blank=True, default='')
    phone = models.CharField(_('Telefone Celular'), max_length=30, blank=True, default='')
    email = models.EmailField(_('E-mail'), blank=True, default='')

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Transportadora')
        verbose_name_plural = _('Transportadoras')
        ordering = ['code']

    def __str__(self) -> str:
        return f'{self.code} — {self.name}'


class TransportadoraALZT(TimestampedModel):
    """ALZ-owned transport branches (BD-Transportadora ALZT sheet).

    These are ALZ's own subsidiaries that operate as carriers.
    Kept as a separate model per business requirement.
    On the form, users can select from both Transportadora and TransportadoraALZT
    via the unified /lookups/freight-agents/ endpoint.
    """

    sap_code = models.CharField(_('Código Filial (SAP)'), max_length=10, unique=True)
    state = models.CharField(_('Estado (UF)'), max_length=2, blank=True, default='')
    cnpj = models.CharField('CNPJ', max_length=18, blank=True, default='')
    description = models.CharField(_('Descrição'), max_length=200)
    email = models.EmailField(_('E-mail'), blank=True, default='')
    phone = models.CharField(_('Telefone'), max_length=30, blank=True, default='')

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Transportadora ALZT')
        verbose_name_plural = _('Transportadoras ALZT')
        ordering = ['sap_code']

    def __str__(self) -> str:
        return f'{self.sap_code} — {self.description}'
