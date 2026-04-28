"""Invoice-related domain models.

See docs/03-database-schema.md §7 (nf_future_delivery).
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _
from simple_history.models import HistoricalRecords


class NFFutureDelivery(models.Model):
    """Mother "NF de Entrega Futura" invoice.

    Issued up-front against a contract lot; subsequent OVs/child NFs draw
    down its balance until fully delivered.
    """

    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', _('Em andamento')
        FINISHED = 'finished', _('Finalizada')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nf_number = models.CharField(_('Nº NF'), max_length=20)
    nf_key = models.CharField(_('Chave NF'), max_length=44, blank=True, default='')
    quantity_kg = models.DecimalField(_('Qtd NF (kg)'), max_digits=15, decimal_places=3)
    unit_value = models.DecimalField(
        _('Valor unitário'), max_digits=15, decimal_places=6, default=0
    )
    gross_value = models.DecimalField(
        _('Valor bruto'), max_digits=15, decimal_places=2, default=0
    )
    branch_name = models.CharField(_('Filial'), max_length=100, blank=True, default='')
    product = models.CharField(_('Produto'), max_length=50, blank=True, default='')
    harvest_year = models.CharField(_('Safra'), max_length=4, blank=True, default='')
    issue_date = models.DateField(_('Data emissão'), null=True, blank=True)
    sap_code = models.CharField(_('Código SAP'), max_length=20, blank=True, default='')
    state_registration = models.CharField(
        _('Inscrição estadual'), max_length=20, blank=True, default=''
    )
    lot_number = models.CharField(
        _('Nº Lote'), max_length=30, blank=True, default='', db_index=True
    )
    producer_name = models.CharField(
        _('Nome produtor'), max_length=200, blank=True, default=''
    )
    status = models.CharField(
        _('Status'), max_length=20, choices=Status.choices, default=Status.IN_PROGRESS
    )
    delivered_quantity_kg = models.DecimalField(
        _('Qtd entregue (kg)'), max_digits=15, decimal_places=3, default=0
    )
    remaining_quantity_kg = models.DecimalField(
        _('Saldo (kg)'), max_digits=15, decimal_places=3, default=0
    )
    xml_file = models.FileField(
        _('Arquivo XML'), upload_to='nf_future_delivery/%Y/%m/', null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('NF Entrega Futura')
        verbose_name_plural = _('NFs Entrega Futura')
        ordering = ['-issue_date', '-created_at']

    def __str__(self) -> str:
        return f'{self.nf_number} — {self.lot_number or "?"}'


class NFValidationError(models.Model):
    """Catalog of validation error codes used when a child NF fails to match a mother NF.

    See docs/06-nf-validation.md §Error Catalog.
    """

    code = models.CharField(_('Código'), max_length=40, primary_key=True)
    level = models.PositiveSmallIntegerField(
        _('Nível'),
        choices=[(1, 'Nível 1 (NFref)'), (2, 'Nível 2 (IE)'), (3, 'Nível 3 (OV chain)')],
    )
    message_pt = models.CharField(_('Mensagem PT-BR'), max_length=255)
    detail_pt = models.TextField(_('Detalhe PT-BR'), blank=True, default='')
    recommended_action = models.TextField(
        _('Ação recomendada'), blank=True, default=''
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Erro de validação de NF')
        verbose_name_plural = _('Erros de validação de NF')
        ordering = ['level', 'code']

    def __str__(self) -> str:
        return f'{self.code} — {self.message_pt}'


class ChildNF(models.Model):
    """Child NF issued during actual deliveries against a mother NF de Entrega Futura.

    The RPA writes these rows with ``validation_*`` fields filled; the portal
    surfaces the result. See docs/06-nf-validation.md for the 3-level cascade.
    """

    class ValidationStatus(models.TextChoices):
        PENDING = 'pending', _('Aguardando validação')
        VALID = 'valid', _('Validada')
        INVALID = 'invalid', _('Não validada')
        NEEDS_REVIEW = 'needs_review', _('Revisão manual')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mother_nf = models.ForeignKey(
        NFFutureDelivery,
        on_delete=models.CASCADE,
        related_name='children',
        null=True,
        blank=True,
        verbose_name=_('NF mãe'),
    )
    nf_number = models.CharField(_('Nº NF filha'), max_length=20, db_index=True)
    nf_key = models.CharField(_('Chave NF'), max_length=44, blank=True, default='', db_index=True)
    serie = models.CharField(_('Série'), max_length=10, blank=True, default='')
    issue_date = models.DateField(_('Data emissão'), null=True, blank=True)
    emitter_cnpj = models.CharField(_('CNPJ emitente'), max_length=20, blank=True, default='')
    emitter_state_registration = models.CharField(
        _('IE emitente'), max_length=20, blank=True, default=''
    )
    quantity_kg = models.DecimalField(
        _('Qtd (kg)'), max_digits=15, decimal_places=3, default=0
    )
    unit_value = models.DecimalField(
        _('Valor unitário'), max_digits=15, decimal_places=6, default=0
    )

    validation_level = models.PositiveSmallIntegerField(
        _('Nível atingido'), null=True, blank=True
    )
    validation_status = models.CharField(
        _('Status validação'),
        max_length=20,
        choices=ValidationStatus.choices,
        default=ValidationStatus.PENDING,
        db_index=True,
    )
    validation_error = models.ForeignKey(
        NFValidationError,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='child_nfs',
        verbose_name=_('Erro de validação'),
    )
    validation_detail = models.TextField(_('Detalhe validação'), blank=True, default='')
    validated_at = models.DateTimeField(_('Validado em'), null=True, blank=True)

    has_correction_letter = models.BooleanField(
        _('Possui Carta de Correção'), default=False
    )
    correction_new_mother_ref = models.CharField(
        _('Nova referência da CC'), max_length=44, blank=True, default=''
    )

    xml_file = models.FileField(
        _('Arquivo XML'), upload_to='child_nf/%Y/%m/', null=True, blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = _('NF filha')
        verbose_name_plural = _('NFs filhas')
        ordering = ['-issue_date', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['nf_key'],
                condition=~models.Q(nf_key=''),
                name='childnf_unique_nf_key_when_present',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.nf_number} — {self.get_validation_status_display()}'


class NFXmlFile(models.Model):
    """Long-term archive of every NF XML received by the platform.

    The mother and child NF tables already keep the most recent XML in
    their ``xml_file`` field; this table mirrors every XML upload (mother,
    child, correction letter) so the RPA / portal can hand them out for
    download later, even after re-uploads or reprocessings.
    """

    class Kind(models.TextChoices):
        MOTHER = 'mother', _('NF mãe')
        CHILD = 'child', _('NF filha')
        CCE = 'cce', _('Carta de correção')
        OTHER = 'other', _('Outro')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(
        _('Tipo'), max_length=20, choices=Kind.choices, default=Kind.OTHER
    )
    nf_key = models.CharField(_('Chave NF'), max_length=44, blank=True, default='', db_index=True)
    nf_number = models.CharField(_('Nº NF'), max_length=20, blank=True, default='')
    mother_nf = models.ForeignKey(
        NFFutureDelivery,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='xml_files',
        verbose_name=_('NF mãe'),
    )
    child_nf = models.ForeignKey(
        ChildNF,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='xml_files',
        verbose_name=_('NF filha'),
    )
    file = models.FileField(_('Arquivo'), upload_to='nf_xml/%Y/%m/')
    original_filename = models.CharField(
        _('Nome original'), max_length=255, blank=True, default=''
    )
    size_bytes = models.PositiveIntegerField(_('Tamanho (bytes)'), default=0)
    uploaded_by = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='nf_xml_uploads',
        verbose_name=_('Enviado por'),
    )
    source = models.CharField(
        _('Origem'),
        max_length=30,
        blank=True,
        default='',
        help_text=_('portal, rpa, ocr, nfe_key, ...'),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Arquivo XML de NF')
        verbose_name_plural = _('Arquivos XML de NF')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['nf_key']),
            models.Index(fields=['nf_number']),
        ]

    def __str__(self) -> str:
        return f'{self.get_kind_display()} — {self.nf_number or self.nf_key or self.pk}'

