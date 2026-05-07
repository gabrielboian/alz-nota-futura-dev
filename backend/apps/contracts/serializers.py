"""DRF serializers for contracts."""
from rest_framework import serializers

from apps.core.models import Branch
from apps.core.serializers import (
    BranchSerializer,
    CommercialResponsibleSerializer,
    CorridorSerializer,
    ParticipantSerializer,
    TerminalDestinationSerializer,
    TipoFreteSaidaSerializer,
    TransshipmentLocationSerializer,
)

from .models import ContractBaseLot, ContractManagedLot, ContractUpload


class ContractUploadSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = ContractUpload
        fields = (
            'id', 'upload_date', 'status', 'observations', 'user', 'user_email',
            'file', 'row_count', 'error_count', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'upload_date', 'status', 'user', 'user_email',
                            'row_count', 'error_count', 'observations',
                            'created_at', 'updated_at')


class ContractBaseLotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractBaseLot
        fields = '__all__'


class ContractManagedLotSerializer(serializers.ModelSerializer):
    """Read-only serializer used for list/retrieve responses."""

    base_lot_data = ContractBaseLotSerializer(source='base_lot', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    rfl_value_sack = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    cif_freight_agent_code = serializers.SerializerMethodField()

    # Nested FK objects
    commercial_responsible_obj = CommercialResponsibleSerializer(
        source='commercial_responsible', read_only=True, default=None
    )
    freight_type_exit_obj = TipoFreteSaidaSerializer(
        source='freight_type_exit', read_only=True, default=None
    )
    transshipment_location_obj = TransshipmentLocationSerializer(
        source='transshipment_location', read_only=True, default=None
    )
    terminal_destination_obj = TerminalDestinationSerializer(
        source='terminal_destination', read_only=True, default=None
    )
    participant_obj = ParticipantSerializer(
        source='participant', read_only=True, default=None
    )
    corridor_obj = CorridorSerializer(
        source='corridor', read_only=True, default=None
    )
    billing_branch_obj = BranchSerializer(
        source='billing_branch', read_only=True, default=None
    )

    class Meta:
        model = ContractManagedLot
        fields = '__all__'
        read_only_fields = ('id', 'released_at', 'released_by', 'created_at', 'updated_at')

    def get_cif_freight_agent_code(self, obj) -> str:
        """Returns the CIF transportadora code for the lot's emitting branch."""
        branch_name = (obj.base_lot.branch_name or '').strip() if obj.base_lot else ''
        if not branch_name:
            return ''
        branch = (
            Branch.objects
            .filter(sap_code__iexact=branch_name)
            .select_related('cif_transportadora')
            .first()
        )
        if branch and branch.cif_transportadora:
            return branch.cif_transportadora.code
        return ''


# Portal enrichment fields the commercial team fills in before requesting a shipment.
# Everything related to workflow state (status, shipment_released, released_*)
# is deliberately excluded and mutated only via the shipments viewset actions.
MANAGED_LOT_PORTAL_FIELDS = (
    'commercial_responsible',
    'harvest_year',
    'pickup_location',
    'loading_site',
    'collection_point_code',
    'loading_state_registration',
    'freight_type_exit',
    'region',
    'phone',
    'email',
    'route_description',
    'scale_over_25m',
    'silo_bag_loading',
    'has_transshipment',
    'transshipment_location',
    'terminal_destination',
    'delivery_window_start',
    'delivery_window_end',
    'has_participant',
    'participant',
    'delivered_by_holder',
    'billing_producer_name',
    'client_state_registration',
    'cnpj_billing',
    'commercial_responsible_name',
    'rfl_value_kg',
    'executed_freight_value',
    'corridor',
    'freight_agent',
    'scheduling',
    'route_info',
    'billing_branch',
    'has_nf_future_delivery',
    'nf_key_future_delivery',
)


class ContractManagedLotUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for portal enrichment (PATCH/PUT).

    Excludes base_lot, status, shipment_released, and released_* — those are
    controlled by the shipment workflow, not by the commercial portal.
    """

    class Meta:
        model = ContractManagedLot
        fields = MANAGED_LOT_PORTAL_FIELDS

    def validate(self, attrs):
        start = attrs.get('delivery_window_start', getattr(self.instance, 'delivery_window_start', None))
        end = attrs.get('delivery_window_end', getattr(self.instance, 'delivery_window_end', None))
        if start and end and end < start:
            raise serializers.ValidationError({
                'delivery_window_end': 'Data final da janela deve ser maior ou igual à inicial.',
            })

        has_transshipment = attrs.get(
            'has_transshipment', getattr(self.instance, 'has_transshipment', False)
        )
        transshipment_location = attrs.get(
            'transshipment_location',
            getattr(self.instance, 'transshipment_location', None),
        )
        if has_transshipment and not transshipment_location:
            raise serializers.ValidationError({
                'transshipment_location': 'Obrigatório quando "Com transbordo" está marcado.',
            })

        has_participant = attrs.get(
            'has_participant', getattr(self.instance, 'has_participant', False)
        )
        if has_participant:
            participant = attrs.get(
                'participant', getattr(self.instance, 'participant', None)
            )
            if not participant:
                raise serializers.ValidationError({
                    'participant': 'Obrigatório quando "Carga com participante" está marcado.',
                })
        else:
            attrs['participant'] = None
        return attrs

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        # simple_history reads ALL instance fields to create the historical snapshot,
        # even when update_fields is set. Guard against legacy NULL boolean fields
        # (result of the CharField→BooleanField migration not back-filling every row)
        # so the historical table's NOT NULL constraint is never violated.
        _BOOLEAN_DEFAULTS = {
            'route_info': False,
            'scale_over_25m': False,
            'silo_bag_loading': False,
            'has_transshipment': False,
            'has_participant': False,
            'delivered_by_holder': False,
            'shipment_released': False,
        }
        for field_name, default in _BOOLEAN_DEFAULTS.items():
            if getattr(instance, field_name, None) is None:
                setattr(instance, field_name, default)
        instance.save(update_fields=[*validated_data.keys(), 'updated_at'])
        return instance
