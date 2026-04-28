"""Fiscal-related domain models.

See docs/03-database-schema.md §9 (fiscal_instruction).
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class FiscalInstruction(models.Model):
    """Fiscal orientation rules matched by logistics/commercial fields.

    Lookup key: (branch, harvest_year, product, person_type,
                 issuer_state, has_nf_future_delivery).
    """

    class PersonType(models.TextChoices):
        PF = 'PF', _('Pessoa física')
        PJ = 'PJ', _('Pessoa jurídica')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        'core.Branch',
        on_delete=models.PROTECT,
        related_name='fiscal_instructions',
        verbose_name=_('Filial'),
    )
    harvest_year = models.CharField(_('Safra'), max_length=4)
    product = models.CharField(_('Produto'), max_length=50)
    person_type = models.CharField(
        _('Tipo pessoa'), max_length=2, choices=PersonType.choices
    )
    issuer_state = models.CharField(_('UF emitente'), max_length=2)
    has_nf_future_delivery = models.BooleanField(
        _('Possui NF entrega futura'), default=False
    )

    instruction_name = models.CharField(
        _('Nome da instrução'), max_length=255, blank=True, default='',
        help_text=_('Título exibido ao usuário, ex.: "IT Diferimento PI".'),
    )
    instruction_text = models.TextField(_('Orientação'), blank=True, default='')
    destination = models.CharField(_('Destino'), max_length=200, blank=True, default='')
    freight_value = models.CharField(
        _('Valor frete'), max_length=100, blank=True, default=''
    )
    route_description = models.TextField(_('Roteiro'), blank=True, default='')
    client_name = models.CharField(
        _('Cliente'), max_length=200, blank=True, default=''
    )
    pdf_file = models.FileField(
        _('Arquivo PDF'),
        upload_to='fiscal_instructions/',
        blank=True,
        null=True,
        help_text=_('Documento anexado à instrução, disponível para download.'),
    )

    is_active = models.BooleanField(_('Ativo'), default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Instrução fiscal')
        verbose_name_plural = _('Instruções fiscais')
        ordering = ['branch', 'harvest_year', 'product']
        indexes = [
            models.Index(
                fields=[
                    'branch',
                    'harvest_year',
                    'product',
                    'person_type',
                    'issuer_state',
                    'has_nf_future_delivery',
                ],
                name='fisc_inst_lookup_idx',
            ),
        ]

    def __str__(self) -> str:
        return (
            f'{self.branch_id} {self.harvest_year} {self.product} '
            f'{self.person_type}/{self.issuer_state}'
        )
