"""API views for invoices app."""
from decimal import Decimal
from typing import Optional

from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import (
    IsComercial,
    IsFiscal,
    IsInternalStaff,
    IsLogistics,
    IsSystemAdmin,
    HasRPAToken,
)
from apps.integrations.services import nfe_xml_service, ocr_service
from apps.orders.models import SalesOrder

from .models import ChildNF, NFFutureDelivery, NFValidationError, NFXmlFile
from .serializers import (
    ChildNFSerializer,
    NFFutureDeliverySerializer,
    NFValidationErrorSerializer,
    NFXmlFileSerializer,
)
from .xlsx_parser import parse_nf_xlsx
from .xml_parser import ParsedNFe, parse_nfe_xml


def _archive_xml(
    *,
    xml_bytes: bytes,
    kind: str,
    nf_key: str = '',
    nf_number: str = '',
    mother_nf: NFFutureDelivery | None = None,
    child_nf: 'ChildNF | None' = None,
    original_filename: str = '',
    source: str = '',
    uploaded_by=None,
) -> NFXmlFile:
    """Persist a copy of the raw XML bytes into NFXmlFile (long-term archive)."""
    name = original_filename or f'{nf_key or nf_number or "nf"}.xml'
    archive = NFXmlFile(
        kind=kind,
        nf_key=nf_key or '',
        nf_number=nf_number or '',
        mother_nf=mother_nf,
        child_nf=child_nf,
        original_filename=original_filename or name,
        size_bytes=len(xml_bytes or b''),
        source=source,
        uploaded_by=uploaded_by if getattr(uploaded_by, 'is_authenticated', False) else None,
    )
    archive.file.save(name, ContentFile(xml_bytes), save=False)
    archive.save()
    return archive


def _auto_link_sales_order(nf: NFFutureDelivery) -> Optional[SalesOrder]:
    """Link a just-saved NF EF to a matching OV (if any).

    Match key: ``lot_number`` + product (case-insensitive contains on the
    first word of the XML product description).
    Only attaches when exactly one active OV matches and it is not
    already linked to another NF.
    """
    if not nf.lot_number:
        return None
    qs = SalesOrder.objects.filter(
        managed_lot__base_lot__lot_number=nf.lot_number,
        nf_future_delivery__isnull=True,
    )
    if nf.product:
        qs = qs.filter(
            managed_lot__base_lot__product__icontains=nf.product.split()[0]
        )
    candidates = list(qs[:2])
    if len(candidates) != 1:
        return None
    ov = candidates[0]
    ov.nf_future_delivery = nf
    ov.save(update_fields=['nf_future_delivery', 'updated_at'])
    return ov


class NFFutureDeliveryViewSet(viewsets.ModelViewSet):
    """Read-mostly access to mother NFs de Entrega Futura.

    List/retrieve: any internal staff. Writes / upload: Fiscal or Admin.
    """

    queryset = NFFutureDelivery.objects.all()
    serializer_class = NFFutureDeliverySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nf_number', 'nf_key', 'lot_number', 'producer_name']
    ordering_fields = ['issue_date', 'created_at', 'status']
    ordering = ['-issue_date', '-created_at']
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in {'list', 'retrieve'}:
            classes = [
                IsAuthenticated,
                IsComercial | IsLogistics | IsFiscal | IsSystemAdmin,
            ]
        else:
            classes = [IsAuthenticated, IsFiscal | IsSystemAdmin]
        return [cls() for cls in classes]

    def get_queryset(self):
        qs = super().get_queryset()
        lot_number = self.request.query_params.get('lot_number')
        if lot_number:
            qs = qs.filter(lot_number=lot_number)
        nf_key = self.request.query_params.get('nf_key')
        if nf_key:
            qs = qs.filter(nf_key=nf_key)
        state_registration = self.request.query_params.get('state_registration')
        if state_registration:
            qs = qs.filter(state_registration=state_registration)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=False, methods=['post'], url_path='upload-xml')
    def upload_xml(self, request):
        """Create/update a mother NF EF from XML, image/PDF (OCR) or key.

        Accepts any of the three inputs below (mutually exclusive, in
        this priority order):

        1. ``xml_file`` / ``file`` — NF-e XML uploaded directly.
        2. ``file`` with extension ``.pdf/.png/.jpg/.jpeg`` — document is
           sent to the external OCR API to extract the 44-digit key, then
           the XML is fetched from the XML-SAP API.
        3. ``nfe_key`` — 44-digit NF-e key (fetched from XML-SAP API).

        Optional form fields:
            lot_number: override when the XML does not expose a lot.
        """
        lot_override = (request.data.get('lot_number') or '').strip()
        sap_code_input = (request.data.get('sap_code') or '').strip()
        harvest_year_input = (request.data.get('harvest_year') or '').strip()[:4]

        # Resolve the XML content from whichever input the user provided.
        resolution = self._resolve_xml_payload(request)
        if 'error' in resolution:
            return Response(
                {'detail': resolution['error']},
                status=resolution.get('status', status.HTTP_400_BAD_REQUEST),
            )
        xml_bytes: bytes = resolution['xml_bytes']

        try:
            parsed: ParsedNFe = parse_nfe_xml(xml_bytes)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        lot_number = lot_override or parsed.lot_number

        # Enforce one mother NF per contract (lot_number).
        if lot_number:
            conflict = (
                NFFutureDelivery.objects
                .filter(lot_number=lot_number)
                .exclude(nf_key=parsed.nf_key)
                .first()
            )
            if conflict is not None:
                return Response(
                    {
                        'detail': (
                            f'Já existe uma NF mãe (Nº {conflict.nf_number}) '
                            f'vinculada ao contrato {lot_number}. '
                            'Cada contrato pode ter apenas uma NF mãe.'
                        ),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        defaults = {
            'nf_number': parsed.nf_number,
            'quantity_kg': parsed.quantity_kg,
            'unit_value': parsed.unit_value,
            'gross_value': parsed.gross_value,
            'product': parsed.product,
            'issue_date': parsed.issue_date,
            'state_registration': parsed.state_registration,
            'lot_number': lot_number,
            'producer_name': parsed.producer_name,
        }
        if sap_code_input:
            defaults['sap_code'] = sap_code_input
        if harvest_year_input:
            defaults['harvest_year'] = harvest_year_input

        with transaction.atomic():
            nf, created = NFFutureDelivery.objects.get_or_create(
                nf_key=parsed.nf_key, defaults=defaults
            )
            if not created:
                for field_name, value in defaults.items():
                    if value not in (None, '', 0, Decimal('0')):
                        setattr(nf, field_name, value)

            nf.xml_file.save(
                f'{parsed.nf_key or parsed.nf_number}.xml',
                ContentFile(xml_bytes),
                save=False,
            )

            nf.remaining_quantity_kg = (
                nf.quantity_kg - nf.delivered_quantity_kg
                if nf.quantity_kg and nf.quantity_kg > nf.delivered_quantity_kg
                else Decimal('0')
            )
            nf.save()

            linked_ov = _auto_link_sales_order(nf)

            _archive_xml(
                xml_bytes=xml_bytes,
                kind=NFXmlFile.Kind.MOTHER,
                nf_key=parsed.nf_key,
                nf_number=parsed.nf_number,
                mother_nf=nf,
                original_filename=f'{parsed.nf_key or parsed.nf_number}.xml',
                source=resolution.get('source') or 'portal',
                uploaded_by=request.user,
            )

        data = self.get_serializer(nf).data
        data['auto_linked_sales_order_id'] = str(linked_ov.pk) if linked_ov else None
        data['created'] = created
        data['source'] = resolution.get('source')
        return Response(
            data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def _resolve_xml_payload(self, request) -> dict:
        """Return ``{'xml_bytes': bytes, 'source': str}`` or ``{'error': ...}``.

        Handles three input modes: raw XML file, OCR on PDF/image, and
        NF-e key lookup.
        """
        uploaded = (
            request.FILES.get('xml_file')
            or request.FILES.get('file')
            or request.FILES.get('document_file')
        )
        nfe_key_input = (request.data.get('nfe_key') or '').strip()

        if uploaded is not None:
            name = (uploaded.name or '').lower()
            extension = name.rsplit('.', 1)[-1] if '.' in name else ''

            if extension == 'xml':
                return {'xml_bytes': uploaded.read(), 'source': 'xml_file'}

            if extension in ocr_service.SUPPORTED_FORMATS:
                uploaded.seek(0)
                ocr_result = ocr_service.extract_nfe_key(uploaded, uploaded.name)
                if not ocr_result.get('success'):
                    return {
                        'error': ocr_result.get(
                            'error', 'Não foi possível extrair a chave do arquivo.'
                        ),
                        'status': status.HTTP_422_UNPROCESSABLE_ENTITY,
                    }
                chave = ocr_result['chave']
                xml_result = nfe_xml_service.fetch_xml_by_key(chave)
                if not xml_result.get('success'):
                    return {
                        'error': xml_result.get(
                            'error', 'Não foi possível obter o XML após o OCR.'
                        ),
                        'status': status.HTTP_502_BAD_GATEWAY,
                    }
                return {
                    'xml_bytes': xml_result['xml'].encode('utf-8'),
                    'source': f'ocr:{extension}',
                }

            return {
                'error': (
                    'Formato não suportado. Envie um arquivo XML, PDF, PNG, JPG ou JPEG.'
                ),
                'status': status.HTTP_400_BAD_REQUEST,
            }

        if nfe_key_input:
            if len(nfe_key_input) != 44 or not nfe_key_input.isdigit():
                return {
                    'error': 'Chave de NF-e inválida — precisa ter 44 dígitos numéricos.',
                    'status': status.HTTP_400_BAD_REQUEST,
                }
            xml_result = nfe_xml_service.fetch_xml_by_key(nfe_key_input)
            if not xml_result.get('success'):
                return {
                    'error': xml_result.get(
                        'error', 'Não foi possível obter o XML para a chave informada.'
                    ),
                    'status': status.HTTP_502_BAD_GATEWAY,
                }
            return {
                'xml_bytes': xml_result['xml'].encode('utf-8'),
                'source': 'nfe_key',
            }

        return {
            'error': (
                'Envie um arquivo (XML, PDF, PNG, JPG ou JPEG) ou informe a chave '
                'da NF-e (44 dígitos).'
            ),
            'status': status.HTTP_400_BAD_REQUEST,
        }

    @action(detail=False, methods=['post'], url_path='upload-excel')
    def upload_excel(self, request):
        """Bulk import of child NFs from an xlsx file.

        The spreadsheet is the operational "Base de notas filhas" export
        — it lists only child NFs (``Remessa``), each with a
        ``Contrato (Lote de Compra)`` column that links back to the
        existing mother NF uploaded via Gestão de Saldos.

        Multipart payload:
            file: xlsx (required).
            dry_run: optional ``"1"``/``"true"`` — parse and validate only.

        Behaviour:
            * If a row has ``Tipo NF = Compra Futura``, it is rejected —
              mother NFs are created exclusively via Gestão de Saldos.
            * Every other valid row is treated as a child NF and linked
              to the mother that shares the same ``lot_number``. If no
              mother exists yet, the row is reported as an error.
            * ``quantity_kg`` is stored as an absolute value.
            * Each touched mother's ``delivered_quantity_kg`` and
              ``remaining_quantity_kg`` are recomputed from the sum of
              its children.
        """
        upload = request.FILES.get('file') or request.FILES.get('xlsx_file')
        if upload is None:
            return Response(
                {'detail': 'Arquivo xlsx obrigatório (campo "file").'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dry_run = str(request.data.get('dry_run', '')).lower() in ('1', 'true', 'yes')

        try:
            report = parse_nf_xlsx(upload)
        except Exception as exc:  # openpyxl raises plenty of subclasses
            return Response(
                {'detail': f'Falha ao ler a planilha: {exc}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if report.header_errors:
            return Response(
                {'detail': report.header_errors[0]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fields ChildNF accepts — ignore extra spreadsheet columns.
        child_fields = {
            'nf_number', 'nf_key', 'issue_date', 'quantity_kg', 'unit_value',
        }

        children_created = children_updated = 0
        errors: list[dict] = []
        row_results: list[dict] = []
        mothers_by_lot: dict[str, NFFutureDelivery] = {}
        touched_mothers: set[NFFutureDelivery] = set()

        with transaction.atomic():
            sid = transaction.savepoint()

            for parsed in report.parsed:
                if parsed.error:
                    errors.append({
                        'row': parsed.row_number,
                        'nf_number': parsed.data.get('nf_number', ''),
                        'error': parsed.error,
                    })
                    continue

                if parsed.row_type == 'mother':
                    errors.append({
                        'row': parsed.row_number,
                        'nf_number': parsed.data.get('nf_number', ''),
                        'error': (
                            'NFs mãe não podem ser criadas por aqui. '
                            'Use Gestão de Saldos para cadastrar a NF mãe.'
                        ),
                    })
                    continue

                data = {
                    k: v for k, v in parsed.data.items()
                    if k in child_fields and v not in (None, '')
                }
                nf_number = data.pop('nf_number')
                lot_key = (parsed.data.get('lot_number') or '').strip()

                mother = mothers_by_lot.get(lot_key)
                if mother is None and lot_key:
                    mother = NFFutureDelivery.objects.filter(
                        lot_number=lot_key,
                    ).first()
                    if mother is not None:
                        mothers_by_lot[lot_key] = mother

                if mother is None:
                    errors.append({
                        'row': parsed.row_number,
                        'nf_number': nf_number,
                        'error': (
                            f'NF mãe não encontrada para o contrato {lot_key}. '
                            'Faça o upload da NF mãe em Gestão de Saldos primeiro.'
                        ),
                    })
                    continue

                defaults = dict(data)
                defaults['mother_nf'] = mother
                child, was_created = ChildNF.objects.get_or_create(
                    nf_number=nf_number, defaults=defaults,
                )
                if was_created:
                    children_created += 1
                else:
                    changed = False
                    if child.mother_nf_id != mother.pk:
                        child.mother_nf = mother
                        changed = True
                    for field_name, value in data.items():
                        if getattr(child, field_name) != value:
                            setattr(child, field_name, value)
                            changed = True
                    if changed:
                        child.save()
                        children_updated += 1

                touched_mothers.add(mother)
                row_results.append({
                    'row': parsed.row_number,
                    'nf_number': nf_number,
                    'nf_id': str(child.pk),
                    'mother_nf_id': str(mother.pk),
                    'row_type': 'child',
                    'status': 'created' if was_created else 'updated',
                })

            # Recompute delivered / remaining on every mother we touched.
            for mother in touched_mothers:
                delivered = sum(
                    (c.quantity_kg for c in mother.children.all()),
                    start=Decimal('0'),
                )
                remaining = mother.quantity_kg - delivered
                mother.delivered_quantity_kg = delivered
                mother.remaining_quantity_kg = (
                    remaining if remaining > 0 else Decimal('0')
                )
                if remaining <= 0 and mother.quantity_kg > 0:
                    mother.status = NFFutureDelivery.Status.FINISHED
                mother.save(update_fields=[
                    'delivered_quantity_kg',
                    'remaining_quantity_kg',
                    'status',
                    'updated_at',
                ])

            if dry_run:
                transaction.savepoint_rollback(sid)
                children_created = children_updated = 0
            else:
                transaction.savepoint_commit(sid)

        return Response({
            'dry_run': dry_run,
            'rows_total': report.rows_total,
            'rows_valid': report.rows_valid,
            'rows_invalid': report.rows_invalid,
            'children_created': children_created,
            'children_updated': children_updated,
            'errors': errors,
            'results': row_results,
        })

    @action(
        detail=True,
        methods=['get'],
        url_path='children',
        permission_classes=[IsAuthenticated, IsInternalStaff],
    )
    def children(self, request, pk=None):
        """List child NFs linked to this mother NF."""
        nf = self.get_object()
        qs = nf.children.select_related('validation_error').order_by(
            '-issue_date', '-created_at'
        )
        data = ChildNFSerializer(qs, many=True).data
        return Response({'count': len(data), 'results': data})


class NFValidationErrorViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only catalog of child NF validation error codes."""

    queryset = NFValidationError.objects.all()
    serializer_class = NFValidationErrorSerializer
    permission_classes = [IsAuthenticated, IsInternalStaff]
    pagination_class = None


class ChildNFViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only list of child NFs for internal users."""

    queryset = ChildNF.objects.select_related('mother_nf', 'validation_error')
    serializer_class = ChildNFSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nf_number', 'nf_key', 'mother_nf__nf_number']
    ordering_fields = ['issue_date', 'created_at', 'validation_status']
    ordering = ['-issue_date', '-created_at']
    permission_classes = [IsAuthenticated, IsInternalStaff]

    def get_queryset(self):
        qs = super().get_queryset()
        mother_nf = self.request.query_params.get('mother_nf')
        if mother_nf:
            qs = qs.filter(mother_nf_id=mother_nf)
        validation_status = self.request.query_params.get('validation_status')
        if validation_status:
            qs = qs.filter(validation_status=validation_status)
        return qs

    @action(detail=True, methods=['post'], url_path='reprocess-correction')
    def reprocess_correction(self, request, pk=None):
        """Register a Carta de Correção and enqueue an RPA revalidation task.

        Body: ``{"new_mother_ref": "<nf_key or nf_number>", "note": "..." (optional)}``
        """
        from apps.rpa_dispatch.models import RpaDispatchTask

        child: ChildNF = self.get_object()
        new_mother_ref = (request.data.get('new_mother_ref') or '').strip()
        note = (request.data.get('note') or '').strip()

        if not new_mother_ref:
            return Response(
                {'detail': 'new_mother_ref é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Try to resolve the new mother NF for context (non-blocking).
        new_mother = (
            NFFutureDelivery.objects.filter(nf_key=new_mother_ref).first()
            or NFFutureDelivery.objects.filter(nf_number=new_mother_ref).first()
        )

        child.has_correction_letter = True
        child.correction_new_mother_ref = new_mother_ref
        child.validation_status = ChildNF.ValidationStatus.PENDING
        child.validation_error = None
        child.validation_detail = ''
        child.save(update_fields=[
            'has_correction_letter',
            'correction_new_mother_ref',
            'validation_status',
            'validation_error',
            'validation_detail',
            'updated_at',
        ])

        task = RpaDispatchTask.objects.create(
            task_type=RpaDispatchTask.TaskType.NF_CORRECTION_REPROCESS,
            payload={
                'child_nf_id': str(child.pk),
                'child_nf_number': child.nf_number,
                'child_nf_key': child.nf_key,
                'previous_mother_nf_id': str(child.mother_nf_id) if child.mother_nf_id else None,
                'new_mother_ref': new_mother_ref,
                'new_mother_nf_id': str(new_mother.pk) if new_mother else None,
                'note': note,
                'requested_by': request.user.email if request.user.is_authenticated else '',
            },
            related_object_type=RpaDispatchTask.RelatedType.CHILD_NF,
            related_object_id=child.pk,
        )

        return Response(
            {
                'child': ChildNFSerializer(child).data,
                'task_id': str(task.pk),
                'task_status': task.status,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class ChildNFBotViewSet(viewsets.GenericViewSet):
    """Bot-facing writes for child NFs. Authenticated via ``X-RPA-Token``."""

    queryset = ChildNF.objects.all()
    serializer_class = ChildNFSerializer
    permission_classes = [HasRPAToken]
    authentication_classes: list = []

    def _apply_payload(self, instance: ChildNF | None, data: dict) -> ChildNF:
        # Resolve optional FK fields by lookup key to keep payloads simple.
        mother_ref = data.pop('mother_nf_key', None) or data.pop('mother_nf_number', None)
        if mother_ref:
            mother = NFFutureDelivery.objects.filter(nf_key=mother_ref).first()
            if mother is None:
                mother = NFFutureDelivery.objects.filter(nf_number=mother_ref).first()
            data['mother_nf'] = mother.pk if mother else None
        error_code = data.pop('validation_error_code', None)
        if error_code is not None:
            try:
                data['validation_error'] = NFValidationError.objects.get(pk=error_code).pk
            except NFValidationError.DoesNotExist:
                return None  # signal invalid payload

        serializer = ChildNFSerializer(instance=instance, data=data, partial=instance is not None)
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    @action(detail=False, methods=['post'], url_path='upsert')
    def upsert(self, request):
        """Create or update a child NF keyed by ``nf_key`` (preferred) or ``nf_number``."""
        data = dict(request.data)
        nf_key = (data.get('nf_key') or '').strip()
        nf_number = (data.get('nf_number') or '').strip()
        existing = None
        if nf_key:
            existing = ChildNF.objects.filter(nf_key=nf_key).first()
        elif nf_number:
            existing = ChildNF.objects.filter(nf_number=nf_number).first()

        obj = self._apply_payload(existing, data)
        if obj is None:
            return Response(
                {'detail': 'validation_error_code inválido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            ChildNFSerializer(obj).data,
            status=status.HTTP_200_OK if existing else status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='upload-xml', parser_classes=[MultiPartParser, FormParser])
    def upload_xml(self, request):
        """Archive a child NF XML and (optionally) link it to an existing ChildNF row.

        Multipart payload:
            xml_file / file: XML do NF filha (obrigatório).
            nf_key / nf_number: usados para localizar (ou criar) a row de ChildNF.
            mother_nf_key / mother_nf_number: opcional, para vincular à NF mãe.
        """
        uploaded = request.FILES.get('xml_file') or request.FILES.get('file')
        if uploaded is None:
            return Response(
                {'detail': 'Envie o XML em "xml_file" ou "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        xml_bytes = uploaded.read()

        nf_key = (request.data.get('nf_key') or '').strip()
        nf_number = (request.data.get('nf_number') or '').strip()
        mother_ref = (
            (request.data.get('mother_nf_key') or '').strip()
            or (request.data.get('mother_nf_number') or '').strip()
        )

        child = None
        if nf_key:
            child = ChildNF.objects.filter(nf_key=nf_key).first()
        if child is None and nf_number:
            child = ChildNF.objects.filter(nf_number=nf_number).first()

        mother = None
        if mother_ref:
            mother = (
                NFFutureDelivery.objects.filter(nf_key=mother_ref).first()
                or NFFutureDelivery.objects.filter(nf_number=mother_ref).first()
            )

        if child is not None:
            # Persist on ChildNF.xml_file (most-recent copy).
            child.xml_file.save(uploaded.name or f'{nf_key or nf_number}.xml', ContentFile(xml_bytes), save=False)
            if mother is not None and child.mother_nf_id != mother.pk:
                child.mother_nf = mother
            child.save()

        archive = _archive_xml(
            xml_bytes=xml_bytes,
            kind=NFXmlFile.Kind.CHILD,
            nf_key=nf_key,
            nf_number=nf_number,
            mother_nf=mother,
            child_nf=child,
            original_filename=uploaded.name or '',
            source='rpa',
        )

        return Response(
            {
                'archive': NFXmlFileSerializer(archive).data,
                'child_nf_id': str(child.pk) if child else None,
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# RPA-facing read endpoints (X-RPA-Token)
# ---------------------------------------------------------------------------
class NFFutureDeliveryBotViewSet(viewsets.GenericViewSet):
    """Read endpoints used by the RPA to drive its NF-matching workflow.

    All routes authenticate via ``X-RPA-Token``.
    """

    queryset = NFFutureDelivery.objects.all()
    serializer_class = NFFutureDeliverySerializer
    permission_classes = [HasRPAToken]
    authentication_classes: list = []

    @action(detail=False, methods=['get'], url_path='search-by-ie')
    def search_by_ie(self, request):
        """Find mother NFs that still have ``saldo`` (remaining_quantity_kg > 0).

        Query params:
            state_registration / ie: IE do emitente (obrigatório).
            status: ``in_progress`` (default) ou ``finished``.
        """
        ie = (
            request.query_params.get('state_registration')
            or request.query_params.get('ie')
            or ''
        ).strip()
        status_param = (
            request.query_params.get('status') or NFFutureDelivery.Status.IN_PROGRESS
        ).strip()

        if not ie:
            return Response(
                {'detail': 'Informe state_registration (IE).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = (
            NFFutureDelivery.objects
            .filter(state_registration=ie, remaining_quantity_kg__gt=0)
        )
        if status_param:
            qs = qs.filter(status=status_param)
        qs = qs.order_by('-issue_date', '-created_at')[:200]

        data = NFFutureDeliverySerializer(qs, many=True).data
        return Response({'count': len(data), 'results': data})

    @action(detail=False, methods=['get'], url_path='search-by-nf-key')
    def search_by_nf_key(self, request):
        """Find a mother NF by exact chave de acesso (44 dígitos).

        Query params:
            nf_key: chave de acesso de 44 dígitos (obrigatório).
            status: ``in_progress`` ou ``finished`` (opcional).
        """
        nf_key = (request.query_params.get('nf_key') or '').strip()
        if not nf_key:
            return Response(
                {'detail': 'Informe nf_key (chave de acesso de 44 dígitos).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = NFFutureDelivery.objects.filter(nf_key=nf_key)
        status_param = (request.query_params.get('status') or '').strip()
        if status_param:
            qs = qs.filter(status=status_param)
        qs = qs.order_by('-issue_date', '-created_at')[:10]

        data = NFFutureDeliverySerializer(qs, many=True).data
        return Response({'count': len(data), 'results': data})

    @action(detail=False, methods=['get'], url_path='search-by-nf-number')
    def search_by_nf_number(self, request):
        """Find mother NFs by número da nota + IE + status.

        Query params:
            nf_number: número da NF (obrigatório).
            state_registration / ie: IE do emitente (opcional, recomendado para desambiguar).
            status: ``in_progress`` ou ``finished`` (opcional).
        """
        nf_number = (request.query_params.get('nf_number') or '').strip()
        if not nf_number:
            return Response(
                {'detail': 'Informe nf_number.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = NFFutureDelivery.objects.filter(nf_number=nf_number)
        ie = (
            request.query_params.get('state_registration')
            or request.query_params.get('ie')
            or ''
        ).strip()
        if ie:
            qs = qs.filter(state_registration=ie)
        status_param = (request.query_params.get('status') or '').strip()
        if status_param:
            qs = qs.filter(status=status_param)
        qs = qs.order_by('-issue_date', '-created_at')[:50]

        data = NFFutureDeliverySerializer(qs, many=True).data
        return Response({'count': len(data), 'results': data})

    @action(detail=False, methods=['get'], url_path='lookup')
    def lookup(self, request):
        """Resolve a mother NF + its children + linked contract / OVs.

        Provide ANY of these query params (priority in order listed):
            nf_number: Nº da NF mãe.
            nf_key: chave de 44 dígitos da NF mãe.
            contract_number / lot_number: nº do contrato (lote de compra).
            ov_number: Nº de qualquer OV ligada ao contrato.
        """
        from apps.contracts.models import ContractBaseLot, ContractManagedLot
        from apps.contracts.serializers import (
            ContractBaseLotSerializer,
            ContractManagedLotSerializer,
        )
        from apps.orders.models import SalesOrder
        from apps.orders.serializers import SalesOrderSerializer

        nf_number = (request.query_params.get('nf_number') or '').strip()
        nf_key = (request.query_params.get('nf_key') or '').strip()
        contract_number = (
            request.query_params.get('contract_number')
            or request.query_params.get('lot_number')
            or ''
        ).strip()
        ov_number = (request.query_params.get('ov_number') or '').strip()

        if not any([nf_number, nf_key, contract_number, ov_number]):
            return Response(
                {
                    'detail': (
                        'Informe ao menos um dos parâmetros: nf_number, nf_key, '
                        'contract_number ou ov_number.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        mother: NFFutureDelivery | None = None
        resolved_lot_number: str = ''
        sales_order: SalesOrder | None = None

        if nf_key:
            mother = NFFutureDelivery.objects.filter(nf_key=nf_key).first()
        if mother is None and nf_number:
            mother = NFFutureDelivery.objects.filter(nf_number=nf_number).first()
        if mother is None and contract_number:
            mother = NFFutureDelivery.objects.filter(lot_number=contract_number).first()
            resolved_lot_number = contract_number
        if ov_number:
            sales_order = (
                SalesOrder.objects
                .select_related('managed_lot__base_lot', 'nf_future_delivery')
                .filter(ov_number=ov_number)
                .first()
            )
            if sales_order is not None:
                if mother is None:
                    mother = sales_order.nf_future_delivery
                if not resolved_lot_number and sales_order.managed_lot_id:
                    resolved_lot_number = (
                        sales_order.managed_lot.base_lot.lot_number
                        if sales_order.managed_lot.base_lot_id
                        else ''
                    )

        if mother is None and not resolved_lot_number and not sales_order:
            return Response(
                {'detail': 'Nenhum registro encontrado para os parâmetros informados.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Resolve the contract lot from whatever we managed to identify.
        if not resolved_lot_number and mother is not None:
            resolved_lot_number = mother.lot_number

        base_lot = None
        managed_lots: list[ContractManagedLot] = []
        if resolved_lot_number:
            base_lot = (
                ContractBaseLot.objects
                .filter(lot_number=resolved_lot_number)
                .order_by('-created_at')
                .first()
            )
            if base_lot is not None:
                managed_lots = list(
                    ContractManagedLot.objects.filter(base_lot=base_lot)
                )

        children_qs = mother.children.all() if mother is not None else ChildNF.objects.none()
        sales_orders_qs: list[SalesOrder] = []
        if managed_lots:
            sales_orders_qs = list(
                SalesOrder.objects
                .filter(managed_lot__in=managed_lots)
                .order_by('order_index', 'created_at')
            )
        elif sales_order is not None:
            sales_orders_qs = [sales_order]
        elif mother is not None:
            sales_orders_qs = list(mother.sales_orders.all().order_by('order_index'))

        return Response(
            {
                'mother_nf': (
                    NFFutureDeliverySerializer(mother).data if mother else None
                ),
                'children': ChildNFSerializer(children_qs, many=True).data,
                'contract_base_lot': (
                    ContractBaseLotSerializer(base_lot).data if base_lot else None
                ),
                'managed_lots': ContractManagedLotSerializer(managed_lots, many=True).data,
                'sales_orders': SalesOrderSerializer(sales_orders_qs, many=True).data,
                'matched_by': {
                    'nf_number': bool(nf_number),
                    'nf_key': bool(nf_key),
                    'contract_number': bool(contract_number),
                    'ov_number': bool(ov_number),
                },
            }
        )

