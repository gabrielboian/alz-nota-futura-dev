"""Generic dispatch-task queue consumed by the RPA bot.

The backend never talks to SMTP / WhatsApp / Desk Manager directly.
It only enqueues a task row; the RPA polls, executes, then reports back.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _


class RpaDispatchTask(models.Model):
    class TaskType(models.TextChoices):
        FISCAL_INSTRUCTION_EMAIL = 'fiscal_instruction_email', _('Envio de instrução fiscal (e-mail)')
        FISCAL_INSTRUCTION_WHATSAPP = 'fiscal_instruction_whatsapp', _('Envio de instrução fiscal (WhatsApp)')
        DESK_MANAGER_TICKET = 'desk_manager_ticket', _('Abertura de chamado Desk Manager')
        NF_CORRECTION_REPROCESS = 'nf_correction_reprocess', _('Reprocessar NF após carta de correção')

    class Status(models.TextChoices):
        PENDING = 'pending', _('Pendente')
        IN_PROGRESS = 'in_progress', _('Em execução')
        COMPLETED = 'completed', _('Concluído')
        ERROR = 'error', _('Erro')

    class RelatedType(models.TextChoices):
        FISCAL_INSTRUCTION = 'fiscal_instruction', _('Instrução fiscal')
        SALES_ORDER = 'sales_order', _('Ordem de venda')
        SHIPMENT_REQUEST = 'shipment_request', _('Solicitação de embarque')
        CHILD_NF = 'child_nf', _('NF filha')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task_type = models.CharField(
        _('Tipo'), max_length=40, choices=TaskType.choices, db_index=True
    )
    status = models.CharField(
        _('Status'), max_length=20, choices=Status.choices,
        default=Status.PENDING, db_index=True,
    )
    payload = models.JSONField(_('Payload'), default=dict, blank=True)
    related_object_type = models.CharField(
        _('Tipo do objeto'), max_length=40, choices=RelatedType.choices, blank=True, default='',
    )
    related_object_id = models.UUIDField(_('ID do objeto'), null=True, blank=True)
    external_reference = models.CharField(
        _('Referência externa'), max_length=100, blank=True, default='',
        help_text=_('Nº do chamado / id da mensagem retornado pelo RPA.'),
    )
    error_message = models.TextField(_('Mensagem de erro'), blank=True, default='')
    retry_count = models.PositiveIntegerField(_('Tentativas'), default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    last_attempt_at = models.DateTimeField(_('Última tentativa'), null=True, blank=True)
    completed_at = models.DateTimeField(_('Concluído em'), null=True, blank=True)

    class Meta:
        verbose_name = _('Tarefa RPA')
        verbose_name_plural = _('Tarefas RPA')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'task_type']),
            models.Index(fields=['related_object_type', 'related_object_id']),
        ]

    def __str__(self) -> str:
        return f'{self.task_type} · {self.status}'
