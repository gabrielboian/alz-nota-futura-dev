"""Idempotent seeding of lookup reference data (Branch, TerminalDestination, etc.).

Loads `apps/core/fixtures/lookups.json` via Django's loaddata — safe to run
multiple times; fixture PKs ensure upsert semantics.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.core.models import (
    Branch,
    CommercialResponsible,
    Corridor,
    Participant,
    TerminalDestination,
    TransshipmentLocation,
)

LOOKUP_MODELS = [
    Branch,
    TerminalDestination,
    Participant,
    CommercialResponsible,
    Corridor,
    TransshipmentLocation,
]


class Command(BaseCommand):
    help = 'Seed lookup reference data (Filiais, Terminais, Participantes, etc.).'

    def handle(self, *args, **options):
        self.stdout.write('Seeding lookup data from apps/core/fixtures/lookups.json…')
        call_command('loaddata', 'lookups.json', app_label='core', verbosity=1)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Lookup counts após seed:'))
        for model in LOOKUP_MODELS:
            self.stdout.write(f'  {model.__name__}: {model.objects.count()}')
