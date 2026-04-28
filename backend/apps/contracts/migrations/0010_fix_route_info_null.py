# Fixes rows where route_info is NULL after the CharField→BooleanField migration
# (empty string '' was cast to NULL in SQLite during the table-recreation step).
from django.db import migrations


def backfill_route_info(apps, schema_editor):
    ContractManagedLot = apps.get_model('contracts', 'ContractManagedLot')
    ContractManagedLot.objects.filter(route_info__isnull=True).update(route_info=False)
    HistoricalContractManagedLot = apps.get_model('contracts', 'HistoricalContractManagedLot')
    HistoricalContractManagedLot.objects.filter(route_info__isnull=True).update(route_info=False)


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0009_contractmanagedlot_freight_agent_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_route_info, migrations.RunPython.noop),
    ]
