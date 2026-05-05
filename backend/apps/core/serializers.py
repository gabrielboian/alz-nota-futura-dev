"""Read-only serializers for reference/lookup data (dropdowns)."""
from rest_framework import serializers

from .models import (
    Branch,
    CommercialResponsible,
    Corridor,
    Participant,
    Producer,
    TerminalDestination,
    ExitFreightType,
    TransshipmentLocation,
    Carrier,
    CarrierALZT,
)


class BranchSerializer(serializers.ModelSerializer):
    cif_transportadora_code = serializers.CharField(
        source='cif_transportadora.code', read_only=True, default=''
    )

    class Meta:
        model = Branch
        fields = ('id', 'sap_code', 'description', 'state', 'cnpj', 'type', 'cif_transportadora_code')


class TerminalDestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerminalDestination
        fields = ('id', 'name', 'is_transshipment', 'sap_client_code', 'sap_supplier_code', 'customs_facility_code')


class TransshipmentLocationSerializer(serializers.ModelSerializer):
    branch_sap_code = serializers.CharField(source='branch.sap_code', read_only=True, default='')

    class Meta:
        model = TransshipmentLocation
        fields = ('id', 'name', 'branch', 'branch_sap_code')


class TipoFreteSaidaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExitFreightType
        fields = ('id', 'name', 'incoterm', 'loc_incoterm', 'description_short', 'description')


class TransportadoraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Carrier
        fields = ('id', 'code', 'name', 'state', 'cnpj', 'phone', 'email')

    def validate_code(self, value: str) -> str:
        return (value or '').strip()

    def validate_name(self, value: str) -> str:
        cleaned = (value or '').strip()
        if not cleaned:
            raise serializers.ValidationError('Informe o nome da transportadora.')
        return cleaned

    def create(self, validated_data):
        code = validated_data['code']
        existing = Carrier.objects.filter(code__iexact=code).first()
        if existing:
            return existing
        return super().create(validated_data)


class TransportadoraALZTSerializer(serializers.ModelSerializer):
    class Meta:
        model = CarrierALZT
        fields = ('id', 'sap_code', 'description', 'state', 'cnpj', 'phone', 'email')


class FreightAgentSerializer(serializers.Serializer):
    """Read-only unified view of both Transportadora and TransportadoraALZT.

    Returns a normalised list: {code, name, state, cnpj, source}.
    - source='transportadora'  → third-party carrier
    - source='alzt'            → ALZ-owned transport branch
    """

    code = serializers.CharField()
    name = serializers.CharField()
    state = serializers.CharField()
    cnpj = serializers.CharField()
    source = serializers.CharField()


class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ('id', 'name', 'sap_code', 'inscricao_estadual', 'cnpj')


class CommercialResponsibleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommercialResponsible
        fields = ('id', 'name', 'state', 'branch', 'corporate_phone', 'email')


class CorridorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Corridor
        fields = ('id', 'code', 'name', 'description')


class ProducerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producer
        fields = ('id', 'name', 'cpf_cnpj')

    def validate_name(self, value: str) -> str:
        cleaned = (value or '').strip()
        if not cleaned:
            raise serializers.ValidationError('Informe o nome do produtor.')
        return cleaned

    def create(self, validated_data):
        name = validated_data['name']
        # Case-insensitive get-or-create: avoid duplicates differing only in casing.
        existing = Producer.objects.filter(name__iexact=name).first()
        if existing:
            return existing
        return super().create(validated_data)
