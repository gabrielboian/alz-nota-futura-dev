"""Read-only lookup endpoints used to populate dropdowns in the portal."""
from itertools import chain

from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
from .serializers import (
    BranchSerializer,
    CommercialResponsibleSerializer,
    CorridorSerializer,
    FreightAgentSerializer,
    ParticipantSerializer,
    ProducerSerializer,
    TerminalDestinationSerializer,
    TipoFreteSaidaSerializer,
    TransshipmentLocationSerializer,
    TransportadoraALZTSerializer,
    TransportadoraSerializer,
)


class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sap_code', 'description', 'state']
    ordering = ['sap_code']
    pagination_class = None


class TerminalDestinationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TerminalDestination.objects.all()
    serializer_class = TerminalDestinationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering = ['name']
    pagination_class = None


class TransshipmentLocationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TransshipmentLocation.objects.all()
    serializer_class = TransshipmentLocationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering = ['name']
    pagination_class = None


class ParticipantViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'cnpj', 'inscricao_estadual', 'sap_code']
    ordering = ['name']
    pagination_class = None


class CommercialResponsibleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CommercialResponsible.objects.all()
    serializer_class = CommercialResponsibleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'state']
    ordering = ['name']
    pagination_class = None


class CorridorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Corridor.objects.all()
    serializer_class = CorridorSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering = ['code']
    pagination_class = None


class ProducerViewSet(viewsets.ModelViewSet):
    """Producer registry. Search-as-you-type via SearchFilter; new entries are
    created on demand via POST when a user types a name that doesn't exist.
    """

    queryset = Producer.objects.all()
    serializer_class = ProducerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'cpf_cnpj']
    ordering_fields = ['name']
    ordering = ['name']


class TipoFreteSaidaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TipoFreteSaida.objects.all()
    serializer_class = TipoFreteSaidaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering = ['name']
    pagination_class = None


class TransportadoraViewSet(viewsets.ModelViewSet):
    """Transportadoras (terceiros). Searchable; new entries can be created on-the-fly (CPT flow)."""

    queryset = Transportadora.objects.all()
    serializer_class = TransportadoraSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name', 'state']
    ordering = ['code']
    pagination_class = None


class TransportadoraALZTViewSet(viewsets.ReadOnlyModelViewSet):
    """Transportadoras ALZT (filiais próprias ALZ). Read-only."""

    queryset = TransportadoraALZT.objects.all()
    serializer_class = TransportadoraALZTSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sap_code', 'description', 'state']
    ordering = ['sap_code']
    pagination_class = None


class FreightAgentListView(APIView):
    """Unified read-only list of all freight agents (Transportadora + TransportadoraALZT).

    Both models are merged and normalised to: {code, name, state, cnpj, source}.
    Supports ?search= for case-insensitive filtering on code or name.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        search = (request.query_params.get('search') or '').strip().lower()

        tp_qs = Transportadora.objects.all()
        alzt_qs = TransportadoraALZT.objects.all()
        if search:
            from django.db.models import Q
            tp_qs = tp_qs.filter(Q(code__icontains=search) | Q(name__icontains=search))
            alzt_qs = alzt_qs.filter(
                Q(sap_code__icontains=search) | Q(description__icontains=search)
            )

        results = []
        for t in tp_qs.order_by('code'):
            results.append({
                'code': t.code,
                'name': t.name,
                'state': t.state,
                'cnpj': t.cnpj,
                'source': 'transportadora',
            })
        for a in alzt_qs.order_by('sap_code'):
            results.append({
                'code': a.sap_code,
                'name': a.description,
                'state': a.state,
                'cnpj': a.cnpj,
                'source': 'alzt',
            })

        serializer = FreightAgentSerializer(results, many=True)
        return Response(serializer.data)
    ordering = ['code']
    pagination_class = None
