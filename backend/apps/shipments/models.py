"""Shipment request domain models.

See docs/03-database-schema.md §4 (shipment_request).
"""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class ShipmentRequest(models.Model):
    """Wizard submission linking a managed lot to a commercial request.

    Created when commercial user submits the "Solicitar embarque" wizard.
    Approved by logistics (which also triggers OV creation via RPA).
    """

    class Status(models.TextChoices):
        PENDING = 'pending', _('Pendente')
        APPROVED = 'approved', _('Aprovado')
        REJECTED = 'rejected', _('Rejeitado')
        CANCELLED = 'cancelled', _('Cancelado')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    managed_lot = models.ForeignKey(
        'contracts.ContractManagedLot',
        on_delete=models.CASCADE,
        related_name='shipment_requests',
        verbose_name=_('Lote'),
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shipment_requests',
        verbose_name=_('Solicitado por'),
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shipment_approvals',
        verbose_name=_('Aprovado por'),
    )
    status = models.CharField(
        _('Status'),
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
    )
    desk_manager_ticket_id = models.CharField(
        _('Ticket Desk Manager'), max_length=50, blank=True, default=''
    )
    requested_at = models.DateTimeField(_('Solicitado em'), auto_now_add=True)
    approved_at = models.DateTimeField(_('Aprovado em'), null=True, blank=True)
    notes = models.TextField(_('Observações'), blank=True, default='')
    harvest_year = models.CharField(_('Safra'), max_length=10, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('Solicitação de Embarque')
        verbose_name_plural = _('Solicitações de Embarque')
        ordering = ['-requested_at']

    def __str__(self) -> str:
        return f'{self.managed_lot_id} — {self.get_status_display()}'
