"""Serializers for invoices app."""
from django.db.models import Count
from rest_framework import serializers

from .models import ChildNF, NFFutureDelivery, NFValidationError, NFXmlFile


class NFValidationErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = NFValidationError
        fields = ['code', 'level', 'message_pt', 'detail_pt', 'recommended_action']


class ChildNFSerializer(serializers.ModelSerializer):
    validation_status_display = serializers.CharField(
        source='get_validation_status_display', read_only=True
    )
    validation_error_code = serializers.CharField(
        source='validation_error.code', read_only=True, default=None
    )
    validation_error_message = serializers.CharField(
        source='validation_error.message_pt', read_only=True, default=None
    )
    mother_nf_number = serializers.CharField(
        source='mother_nf.nf_number', read_only=True, default=None
    )

    class Meta:
        model = ChildNF
        fields = [
            'id',
            'mother_nf',
            'mother_nf_number',
            'nf_number',
            'nf_key',
            'serie',
            'issue_date',
            'emitter_cnpj',
            'emitter_state_registration',
            'quantity_kg',
            'unit_value',
            'validation_level',
            'validation_status',
            'validation_status_display',
            'validation_error',
            'validation_error_code',
            'validation_error_message',
            'validation_detail',
            'validated_at',
            'has_correction_letter',
            'correction_new_mother_ref',
            'xml_file',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class NFFutureDeliverySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    children_summary = serializers.SerializerMethodField()

    class Meta:
        model = NFFutureDelivery
        fields = [
            'id',
            'nf_number',
            'nf_key',
            'quantity_kg',
            'unit_value',
            'gross_value',
            'branch_name',
            'product',
            'harvest_year',
            'issue_date',
            'sap_code',
            'state_registration',
            'lot_number',
            'producer_name',
            'status',
            'status_display',
            'delivered_quantity_kg',
            'remaining_quantity_kg',
            'xml_file',
            'children_summary',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_children_summary(self, obj: NFFutureDelivery) -> dict:
        counts = {'total': 0, 'valid': 0, 'invalid': 0, 'pending': 0, 'needs_review': 0}
        # Access via the reverse relation; use a dict-from-queryset aggregation
        for row in obj.children.values('validation_status').annotate(
            n=Count('id')
        ):
            counts['total'] += row['n']
            counts[row['validation_status']] = row['n']
        return counts


class NFXmlFileSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = NFXmlFile
        fields = [
            'id',
            'kind',
            'kind_display',
            'nf_key',
            'nf_number',
            'mother_nf',
            'child_nf',
            'file',
            'download_url',
            'original_filename',
            'size_bytes',
            'source',
            'uploaded_by',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'size_bytes', 'download_url']

    def get_download_url(self, obj: NFXmlFile) -> str | None:
        if not obj.file:
            return None
        try:
            return obj.file.url
        except Exception:  # noqa: BLE001 — storage backends raise various types
            return None
