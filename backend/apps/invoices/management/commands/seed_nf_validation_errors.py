"""Seed NF validation error catalog (docs/06-nf-validation.md §Error Catalog)."""
from django.core.management.base import BaseCommand

from apps.invoices.models import NFValidationError


ERRORS: list[dict] = [
    {
        'code': 'REF_NOT_FOUND',
        'level': 1,
        'message_pt': 'Divergência Nota Entrega Futura / Referência não localizada',
        'detail_pt': (
            'Localizamos que a inscrição estadual em questão possui notas de entrega '
            'futura com saldo a entregar, porém não foi possível detectar a qual nota '
            'fiscal mãe se refere.'
        ),
        'recommended_action': (
            'Verifique se a NF filha possui a tag <NFref> e se a chave da nota mãe '
            'está correta. Se necessário, emita Carta de Correção apontando a nota '
            'mãe certa.'
        ),
    },
    {
        'code': 'UNIT_VALUE_MISMATCH',
        'level': 1,
        'message_pt': 'Divergência Nota Entrega Futura / Valor unitário divergente',
        'detail_pt': (
            'Identificado que a nota fiscal em questão está com o valor unitário do '
            'produto divergente da nota fiscal mãe de remessa entrega futura '
            'referenciada.'
        ),
        'recommended_action': (
            'Confirme o valor unitário contratado. Emita NF corretiva ou Carta de '
            'Correção ajustando o valor.'
        ),
    },
    {
        'code': 'QTY_EXCEEDED',
        'level': 1,
        'message_pt': 'Divergência Nota Entrega Futura / Qtd excedente a nota mãe',
        'detail_pt': (
            'Identificado que a nota fiscal em questão está com a quantidade maior '
            'que a necessária para finalizar a entrega do volume total da nota fiscal '
            'mãe.'
        ),
        'recommended_action': (
            'Revise a quantidade informada. Se a sobra for legítima, abra nova NF '
            'mãe para o saldo excedente.'
        ),
    },
    {
        'code': 'IE_MISMATCH',
        'level': 2,
        'message_pt': 'Divergência Nota Entrega Futura / Inscrição Estadual Divergente',
        'detail_pt': (
            'A inscrição estadual da nota fiscal não corresponde à inscrição estadual '
            'registrada na nota fiscal mãe de entrega futura.'
        ),
        'recommended_action': (
            'Confirme a IE do emissor. Corrija via Carta de Correção se a nota foi '
            'emitida contra a IE errada.'
        ),
    },
]


class Command(BaseCommand):
    help = 'Seed the NFValidationError catalog with standard error codes.'

    def handle(self, *args, **options):
        created = updated = 0
        for row in ERRORS:
            obj, was_created = NFValidationError.objects.update_or_create(
                code=row['code'],
                defaults={k: v for k, v in row.items() if k != 'code'},
            )
            if was_created:
                created += 1
            else:
                updated += 1
        self.stdout.write(
            self.style.SUCCESS(
                f'NFValidationError catalog: {created} criado(s), {updated} atualizado(s).'
            )
        )
