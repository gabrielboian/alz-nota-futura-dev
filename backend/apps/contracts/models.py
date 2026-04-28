"""Contract domain models.

Three tables: contract_upload (batch), contract_base_lot (raw xlsx rows),
contract_managed_lot (portal-enriched workable lot).
See docs/03-database-schema.md §1-3.
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class TimestampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ContractUpload(TimestampedModel):
    class Status(models.TextChoices):
        PROCESSING = 'processing', _('Em processamento')
        SUCCESS = 'success', _('Upload com sucesso')
        ERROR = 'error', _('Erro upload')

    upload_date = models.DateTimeField(_('Data Upload'), auto_now_add=True)
    status = models.CharField(
        _('Status'), max_length=30, choices=Status.choices, default=Status.PROCESSING
    )
    observations = models.TextField(_('Observações'), blank=True, default='')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='contract_uploads', verbose_name=_('Usuário'),
    )
    file = models.FileField(_('Arquivo'), upload_to='contracts/uploads/%Y/%m/')
    row_count = models.IntegerField(_('Linhas processadas'), default=0)
    error_count = models.IntegerField(_('Linhas com erro'), default=0)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Upload de Contratos')
        verbose_name_plural = _('Uploads de Contratos')
        ordering = ['-upload_date']

    def __str__(self) -> str:
        return f'{self.upload_date:%Y-%m-%d %H:%M} — {self.get_status_display()}'


class ContractBaseLot(TimestampedModel):
    """Raw lot data from BD-Baixa-lote-compra (33 columns)."""

    upload = models.ForeignKey(
        ContractUpload, on_delete=models.CASCADE, related_name='base_lots', verbose_name=_('Upload'),
    )

    cpf_cnpj = models.CharField('CPF/CNPJ', max_length=20, blank=True, default='')
    liquidity = models.CharField(_('Liquidez'), max_length=100, blank=True, default='')
    branch_name = models.CharField(_('Filial'), max_length=100, blank=True, default='')
    producer_name = models.CharField(_('Produtor'), max_length=200, blank=True, default='')
    lot_type = models.CharField(_('Tipo Lote'), max_length=50, blank=True, default='')
    product = models.CharField(_('Produto'), max_length=100, blank=True, default='')
    city = models.CharField(_('Cidade'), max_length=100, blank=True, default='')
    state_code = models.CharField(_('UF'), max_length=10, blank=True, default='')
    lot_number = models.CharField(_('Nº Lote'), max_length=30, db_index=True)
    quantity_kg = models.DecimalField(_('Quantidade (KG)'), max_digits=15, decimal_places=3, default=0)
    delivered_kg = models.DecimalField(_('Entregue (KG)'), max_digits=15, decimal_places=3, default=0)
    reversed_kg = models.DecimalField(_('Qtde Estornada (KG)'), max_digits=15, decimal_places=3, default=0)
    remaining_kg = models.DecimalField(_('A entregar (KG)'), max_digits=15, decimal_places=3, default=0)
    balance = models.DecimalField(_('Saldo'), max_digits=18, decimal_places=3, default=0)
    payment_date = models.DateField(_('Data pagamento'), null=True, blank=True)
    price = models.DecimalField(_('Preço'), max_digits=18, decimal_places=2, default=0)
    freight_type = models.CharField(_('Tipo Frete'), max_length=10, blank=True, default='')
    freight_value = models.DecimalField(_('Vr. Frete'), max_digits=15, decimal_places=2, default=0)
    emits_re = models.BooleanField(_('Emite RE'), default=False)
    purchase_desk_id = models.CharField(_('Id Compra Mesa'), max_length=50, blank=True, default='')
    address_code = models.CharField(_('Cód. Endereço'), max_length=50, blank=True, default='')
    product_type = models.CharField(_('Tipo Produto'), max_length=100, blank=True, default='')
    unit_value = models.DecimalField(_('Unitário'), max_digits=15, decimal_places=6, default=0)
    lot_date = models.DateField(_('Data lote'), null=True, blank=True)
    dap = models.CharField('DAP', max_length=50, blank=True, default='')
    load_producer = models.CharField(_('Produtor Embarque'), max_length=200, blank=True, default='')
    load_location = models.CharField(_('Local de Embarque'), max_length=300, blank=True, default='')
    load_city = models.CharField(_('Cidade Embarque'), max_length=100, blank=True, default='')
    load_state = models.CharField(_('UF Embarque'), max_length=10, blank=True, default='')
    cpf_cnpj_load = models.CharField('CPF/CNPJ Embarque', max_length=20, blank=True, default='')
    delivery_start_date = models.DateField(_('Dt Início Entrega'), null=True, blank=True)
    delivery_end_date = models.DateField(_('Dt Final Entrega'), null=True, blank=True)
    destination_branch = models.CharField(_('Filial Destino'), max_length=100, blank=True, default='')
    currency = models.CharField(_('Moeda'), max_length=10, blank=True, default='')

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Lote Base')
        verbose_name_plural = _('Lotes Base')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['lot_number']),
            models.Index(fields=['cpf_cnpj']),
        ]

    def __str__(self) -> str:
        return f'{self.lot_number} — {self.producer_name}'


class ContractManagedLot(TimestampedModel):
    """Portal-enriched lot (BD-Gestão Contratos — 25 extra columns on top of base)."""

    class Status(models.TextChoices):
        AWAITING_REQUEST = 'awaiting_request', _('Aguardando solicitação de embarque')
        AWAITING_APPROVAL = 'awaiting_approval', _('Aguardando liberação')
        IN_PROGRESS = 'in_progress', _('Embarque em andamento')
        FINISHED = 'finished', _('Embarque Finalizado')
        CANCELLED = 'cancelled', _('Cancelado')

    base_lot = models.OneToOneField(
        ContractBaseLot, on_delete=models.CASCADE, related_name='managed_lot',
        verbose_name=_('Lote Base'),
    )
    status = models.CharField(
        _('Status'), max_length=30, choices=Status.choices, default=Status.AWAITING_REQUEST
    )
    shipment_released = models.BooleanField(_('Embarque Liberado'), default=False)

    commercial_responsible = models.ForeignKey(
        'core.CommercialResponsible', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_lots', verbose_name=_('Comercial Responsável'),
    )
    harvest_year = models.CharField(_('Safra'), max_length=10, blank=True, default='')
    pickup_location = models.CharField(_('Cidade Embarque'), max_length=300, blank=True, default='')
    loading_site = models.CharField(
        _('Local Retirada'),
        max_length=300,
        blank=True,
        default='',
        help_text=_('Nome da Fazenda ou Armazém onde será realizado o embarque do produto.'),
    )
    collection_point_code = models.CharField(
        _('Código Ponto de Coleta'),
        max_length=50,
        blank=True,
        default='',
        help_text=_('Código fornecedor SAP do local de carregamento (buscar na XK03 pela inscrição estadual).'),
    )
    loading_state_registration = models.CharField(
        _('Inscrição Estadual Carregamento'),
        max_length=30,
        blank=True,
        default='',
    )
    freight_type_exit = models.ForeignKey(
        'core.TipoFreteSaida',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_lots',
        verbose_name=_('Tipo Frete Saída'),
    )
    region = models.CharField(_('Região'), max_length=100, blank=True, default='')
    phone = models.CharField(_('Telefone'), max_length=30, blank=True, default='')
    email = models.EmailField(_('E-mail'), blank=True, default='')
    route_description = models.TextField(_('Roteiro'), blank=True, default='')

    scale_over_25m = models.BooleanField(_('Balança > 25m'), default=False)
    silo_bag_loading = models.BooleanField(_('Carregamento silo bolsa'), default=False)
    has_transshipment = models.BooleanField(_('Com transbordo'), default=False)
    transshipment_location = models.ForeignKey(
        'core.TransshipmentLocation', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_lots', verbose_name=_('Local Transbordo'),
    )
    terminal_destination = models.ForeignKey(
        'core.TerminalDestination', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_lots', verbose_name=_('Terminal Destino'),
    )
    delivery_window_start = models.DateField(_('Janela entrega início'), null=True, blank=True)
    delivery_window_end = models.DateField(_('Janela entrega fim'), null=True, blank=True)

    has_participant = models.BooleanField(_('Carga com participante'), default=False)
    participant = models.ForeignKey(
        'core.Participant', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_lots', verbose_name=_('Participante'),
    )
    delivered_by_holder = models.BooleanField(_('Entregue pelo titular'), default=True)

    billing_producer_name = models.CharField(
        _('Nome Produtor Faturamento'), max_length=200, blank=True, default=''
    )
    client_state_registration = models.CharField(
        _('Inscrição Estadual Cliente'), max_length=30, blank=True, default=''
    )
    cnpj_billing = models.CharField('CNPJ Faturamento', max_length=20, blank=True, default='')
    commercial_responsible_name = models.CharField(
        _('Nome Comercial Responsável'), max_length=200, blank=True, default=''
    )
    rfl_value_kg = models.DecimalField(_('Valor pauta RFL (R$/kg)'), max_digits=10, decimal_places=4, default=0)
    executed_freight_value = models.DecimalField(
        _('Vlr frete executado (R$/ton)'), max_digits=12, decimal_places=2, default=0
    )
    corridor = models.ForeignKey(
        'core.Corridor', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_lots', verbose_name=_('Corredor'),
    )
    freight_agent = models.CharField(
        _('Agente Frete'),
        max_length=100,
        blank=True,
        default='',
        help_text=_(
            'Código do agente/transportadora. '
            'CIF → transportadora da filial; FOB → código ponto de coleta; CPT → seleção manual.'
        ),
    )
    scheduling = models.CharField(_('Agendamento'), max_length=50, blank=True, default='')
    route_info = models.BooleanField(_('Percurso: NI'), default=False)

    released_at = models.DateTimeField(_('Data de liberação'), null=True, blank=True)
    released_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='released_managed_lots', verbose_name=_('Liberado por'),
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Lote Gerenciado')
        verbose_name_plural = _('Lotes Gerenciados')
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.base_lot.lot_number} ({self.get_status_display()})'

    @property
    def rfl_value_sack(self):
        """Valor de pauta RFL em R$/saca (60kg)."""
        return self.rfl_value_kg * 60
