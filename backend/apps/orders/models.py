"""Sales Order (OV) and Loading Order (OC) domain models.

See docs/03-database-schema.md §5 (sales_order) and §6 (loading_order).
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class SalesOrder(models.Model):
    """Ordem de Venda (OV).

    Shared table between the portal and the RPA. The portal writes rows
    with ``rpa_status=AWAITING_OV_CREATION``; the RPA populates ``ov_number``
    and transitions ``ov_status``/``rpa_status`` as SAP responds.

    Edit workflow: edits create a NEW row (revision) and set the previous row
    to INVALIDATED. The RPA reads all rows (including invalidated) by contract.
    Use ``original_order`` to trace the full revision chain.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', _('Aguardando criação')
        IN_PROGRESS = 'in_progress', _('Em andamento')
        CLOSED = 'closed', _('Encerrado')
        PAUSED = 'paused', _('Paralisado')
        INVALIDATED = 'invalidated', _('Invalidada')

    class RpaStatus(models.TextChoices):
        AWAITING_OV_CREATION = 'awaiting_ov_creation', _('Aguardando criação OV')
        EXECUTING = 'executing', _('Executando')
        COMPLETED = 'completed', _('Criado')
        ERROR = 'error', _('Erro')
        NOT_APPLICABLE = 'na', _('Não se aplica')
        AWAITING_OV_QUANTITY_UPDATE = 'awaiting_ov_quantity_update', _('Aguardando atualização quantidade OV')

    class RpaErrorType(models.TextChoices):
        BUSINESS_EXCEPTION = 'business_exception', _('Exceção de negócio')
        SYSTEM_EXCEPTION = 'system_exception', _('Exceção de sistema')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ov_number = models.CharField(_('Nº OV'), max_length=20, blank=True, default='')
    external_rpa_id = models.CharField(
        _('ID externo RPA'), max_length=100, blank=True, default=''
    )
    managed_lot = models.ForeignKey(
        'contracts.ContractManagedLot',
        on_delete=models.CASCADE,
        related_name='sales_orders',
        verbose_name=_('Lote'),
    )
    ov_status = models.CharField(
        _('Status OV'), max_length=20, choices=Status.choices, default=Status.PENDING
    )
    rpa_status = models.CharField(
        _('Status RPA'),
        max_length=30,
        choices=RpaStatus.choices,
        default=RpaStatus.AWAITING_OV_CREATION,
    )
    rpa_error_message = models.TextField(_('Erro RPA'), blank=True, default='')
    rpa_error_type = models.CharField(
        _('Tipo erro RPA'),
        max_length=20,
        choices=RpaErrorType.choices,
        blank=True,
        default='',
    )
    rpa_traceback = models.TextField(_('Traceback RPA'), blank=True, default='')
    rpa_screenshot = models.FileField(
        _('Screenshot RPA'), upload_to='rpa_screenshots/', blank=True, null=True
    )
    rpa_last_attempt_at = models.DateTimeField(
        _('Última tentativa RPA'), null=True, blank=True
    )
    rpa_retry_count = models.PositiveIntegerField(_('Tentativas RPA'), default=0)
    creation_event_datetime = models.DateTimeField(
        _('Data evento criação'), auto_now_add=True
    )

    total_quantity_kg = models.DecimalField(
        _('Qtd total OV (kg)'), max_digits=15, decimal_places=3, default=0
    )
    delivered_quantity_kg = models.DecimalField(
        _('Qtd entregue (kg)'), max_digits=15, decimal_places=3, default=0
    )
    balance_kg = models.DecimalField(
        _('Saldo (kg)'), max_digits=15, decimal_places=3, default=0
    )
    cadence = models.CharField(_('Cadência'), max_length=50, blank=True, default='')
    freight_type_exit = models.ForeignKey(
        'core.ExitFreightType',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_orders',
        verbose_name=_('Tipo Frete Saída'),
    )
    harvest_year = models.CharField(_('Safra'), max_length=10, blank=True, default='')
    product_sap_code = models.CharField(_('Código SAP Produto'), max_length=20, blank=True, default='')
    alternative_route = models.BooleanField(_('Percurso Alternativo'), default=False)
    corridor = models.ForeignKey(
        'core.Corridor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_orders',
        verbose_name=_('Corredor'),
    )
    collection_point_code = models.CharField(
        _('Código Ponto de Coleta'), max_length=50, blank=True, default=''
    )
    freight_agent = models.CharField(
        _('Agente Frete'), max_length=100, blank=True, default=''
    )

    billing_branch = models.ForeignKey(
        'core.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='billed_sales_orders',
        verbose_name=_('Filial faturamento'),
    )
    transshipment_location = models.ForeignKey(
        'core.TransshipmentLocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_orders',
        verbose_name=_('Local transbordo'),
    )
    terminal_destination = models.ForeignKey(
        'core.TerminalDestination',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_orders',
        verbose_name=_('Terminal destino'),
    )

    rfl_value_kg = models.DecimalField(
        _('Valor RFL (R$/kg)'), max_digits=10, decimal_places=4, default=0
    )
    freight_value = models.DecimalField(
        _('Valor frete'), max_digits=10, decimal_places=2, default=0
    )
    billing_producer_name = models.CharField(
        _('Nome produtor faturamento'), max_length=200, blank=True, default=''
    )
    client_state_registration = models.CharField(
        _('Inscrição estadual cliente'), max_length=20, blank=True, default=''
    )

    nf_future_delivery = models.ForeignKey(
        'invoices.NFFutureDelivery',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_orders',
        verbose_name=_('NF Entrega Futura'),
    )

    order_index = models.PositiveIntegerField(_('Ordem'), default=1)
    closed_at = models.DateTimeField(_('Data encerramento'), null=True, blank=True)
    manually_created = models.BooleanField(
        _('Criada manualmente'), default=False,
        help_text=_('OV registrada manualmente no portal, sem passar pelo RPA.'),
    )

    # --- Revision / invalidation tracking ---
    original_order = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='revisions',
        verbose_name=_('OV original'),
        help_text=_('Preenchido quando esta OV é uma revisão de outra. Aponta para a OV raíz.'),
    )
    invalidated_at = models.DateTimeField(_('Invalidada em'), null=True, blank=True)
    invalidated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invalidated_sales_orders',
        verbose_name=_('Invalidada por'),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Ordem de Venda')
        verbose_name_plural = _('Ordens de Venda')
        ordering = ['managed_lot', 'order_index', 'created_at']

    def __str__(self) -> str:
        return self.ov_number or f'OV pendente ({self.managed_lot_id})'


class LoadingOrder(models.Model):
    """Ordem de Carregamento (OC) — one truck load within an OV."""

    class Status(models.TextChoices):
        ACTIVE = 'active', _('Ativa')
        INACTIVE = 'inactive', _('Inativa')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    oc_number = models.CharField(_('Nº OC'), max_length=20)
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name='loading_orders',
        verbose_name=_('Ordem de venda'),
    )
    plate = models.CharField(_('Placa'), max_length=10, blank=True, default='')
    weight_kg = models.DecimalField(
        _('Peso (kg)'), max_digits=15, decimal_places=3, default=0
    )
    status = models.CharField(
        _('Status'), max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(_('Data vencimento'), null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Ordem de Carregamento')
        verbose_name_plural = _('Ordens de Carregamento')
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.oc_number} ({self.plate})'
