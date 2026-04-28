"""Serializers for fiscal app."""
from rest_framework import serializers

from .models import FiscalInstruction


class FiscalInstructionSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.description', read_only=True)
    person_type_display = serializers.CharField(
        source='get_person_type_display', read_only=True
    )
    pdf_file_url = serializers.SerializerMethodField()

    class Meta:
        model = FiscalInstruction
        fields = [
            'id',
            'branch',
            'branch_name',
            'harvest_year',
            'product',
            'person_type',
            'person_type_display',
            'issuer_state',
            'has_nf_future_delivery',
            'instruction_name',
            'instruction_text',
            'destination',
            'freight_value',
            'route_description',
            'client_name',
            'pdf_file',
            'pdf_file_url',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'pdf_file_url', 'created_at', 'updated_at']

    def get_pdf_file_url(self, obj):
        if not obj.pdf_file:
            return None
        request = self.context.get('request')
        url = obj.pdf_file.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url
