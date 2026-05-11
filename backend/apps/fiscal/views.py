"""API views for fiscal app."""
from django.http import FileResponse, Http404
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.authentication.permissions import (
    IsFiscal,
    IsSystemAdmin,
)
from apps.rpa_dispatch.models import RpaDispatchTask
from apps.rpa_dispatch.services import enqueue_task

from .models import FiscalInstruction
from .serializers import FiscalInstructionSerializer


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    s = str(value).strip().lower()
    if s in {'true', '1', 's', 'sim', 'yes', 'y'}:
        return True
    if s in {'false', '0', 'n', 'nao', 'não', 'no'}:
        return False
    return None


class FiscalInstructionViewSet(viewsets.ModelViewSet):
    """CRUD for fiscal instructions.

    - list / retrieve / match: any internal staff
    - create / update / delete: Fiscal or Admin
    """

    queryset = FiscalInstruction.objects.select_related('branch')
    serializer_class = FiscalInstructionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        'branch__description',
        'branch__sap_code',
        'harvest_year',
        'product',
        'client_name',
        'destination',
    ]
    ordering_fields = ['branch', 'harvest_year', 'product', 'created_at']
    ordering = ['branch', 'harvest_year', 'product']

    def get_permissions(self):
        # Any authenticated user can list / retrieve / match / download.
        # Mutations remain restricted to Fiscal or System Admin; registration
        # is normally done via Django admin.
        if self.action in {'list', 'retrieve', 'match', 'download'}:
            classes = [IsAuthenticated]
        else:
            classes = [IsAuthenticated, IsFiscal | IsSystemAdmin]
        return [cls() for cls in classes]

    def get_queryset(self):
        qs = super().get_queryset()
        instruction_name = self.request.query_params.get('instruction_name')
        if instruction_name:
            qs = qs.filter(instruction_name__icontains=instruction_name)
        branch = self.request.query_params.get('branch')
        if branch:
            qs = qs.filter(branch_id=branch)
        harvest_year = self.request.query_params.get('harvest_year')
        if harvest_year:
            qs = qs.filter(harvest_year=harvest_year)
        product = self.request.query_params.get('product')
        if product:
            qs = qs.filter(product=product)
        is_active = _parse_bool(self.request.query_params.get('is_active'))
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        person_type = self.request.query_params.get('person_type')
        if person_type:
            qs = qs.filter(person_type=person_type)
        issuer_state = self.request.query_params.get('issuer_state')
        if issuer_state:
            qs = qs.filter(issuer_state=issuer_state)
        return qs

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Stream the attached PDF for download."""
        instruction = self.get_object()
        if not instruction.pdf_file:
            raise Http404('Arquivo não disponível.')
        response = FileResponse(
            instruction.pdf_file.open('rb'),
            as_attachment=True,
            filename=instruction.pdf_file.name.rsplit('/', 1)[-1],
        )
        return response

    @action(detail=False, methods=['get'])
    def match(self, request):
        """Return the single active instruction matching all six lookup fields."""
        required = [
            'branch',
            'harvest_year',
            'product',
            'person_type',
            'issuer_state',
        ]
        missing = [f for f in required if not request.query_params.get(f)]
        if missing:
            return Response(
                {'detail': f'Parâmetros obrigatórios ausentes: {", ".join(missing)}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        has_nf = _parse_bool(request.query_params.get('has_nf_future_delivery'))
        if has_nf is None:
            return Response(
                {'detail': 'has_nf_future_delivery deve ser true/false.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = FiscalInstruction.objects.filter(
            branch_id=request.query_params['branch'],
            harvest_year=request.query_params['harvest_year'],
            product=request.query_params['product'],
            person_type=request.query_params['person_type'],
            issuer_state=request.query_params['issuer_state'],
            has_nf_future_delivery=has_nf,
            is_active=True,
        )
        instruction = qs.first()
        if not instruction:
            return Response(
                {'detail': 'Nenhuma instrução fiscal encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(self.get_serializer(instruction).data)

    @action(detail=True, methods=['post'], url_path='dispatch')
    def send_dispatch(self, request, pk=None):
        """Enqueue RPA tasks to send this instruction to the client.

        Body (optional):
            channels: list[str] in {"email", "whatsapp"} (default both)
            recipients: {"emails": [...], "phones": [...]}
            notes: str  (extra context appended to the payload)
        """
        instruction = self.get_object()
        if not instruction.is_active:
            return Response(
                {'detail': 'Instrução inativa não pode ser disparada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        channels = request.data.get('channels') or ['email', 'whatsapp']
        if not isinstance(channels, list) or not channels:
            return Response(
                {'detail': 'channels deve ser uma lista não vazia.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        recipients = request.data.get('recipients') or {}
        notes = (request.data.get('notes') or '').strip()

        base_payload = {
            'instruction_id': str(instruction.id),
            'branch': instruction.branch.description if instruction.branch_id else '',
            'harvest_year': instruction.harvest_year,
            'product': instruction.product,
            'person_type': instruction.person_type,
            'issuer_state': instruction.issuer_state,
            'has_nf_future_delivery': instruction.has_nf_future_delivery,
            'client_name': instruction.client_name,
            'destination': instruction.destination,
            'freight_value': instruction.freight_value,
            'route_description': instruction.route_description,
            'instruction_text': instruction.instruction_text,
            'recipients': recipients,
            'notes': notes,
        }

        created = []
        for channel in channels:
            if channel == 'email':
                task_type = RpaDispatchTask.TaskType.FISCAL_INSTRUCTION_EMAIL
            elif channel == 'whatsapp':
                task_type = RpaDispatchTask.TaskType.FISCAL_INSTRUCTION_WHATSAPP
            else:
                return Response(
                    {'detail': f'Canal desconhecido: {channel}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            task = enqueue_task(
                task_type=task_type,
                payload=base_payload,
                related_object_type=RpaDispatchTask.RelatedType.FISCAL_INSTRUCTION,
                related_object_id=instruction.id,
            )
            created.append(str(task.id))

        return Response(
            {'enqueued': created, 'count': len(created)},
            status=status.HTTP_201_CREATED,
        )
