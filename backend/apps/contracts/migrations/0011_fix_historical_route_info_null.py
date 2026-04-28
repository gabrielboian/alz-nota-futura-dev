# Fixes NULL route_info in the historical table after the CharField→BooleanField migration.
from django.db import migrations


def backfill_historical_route_info(apps, schema_editor):
    HistoricalContractManagedLot = apps.get_model('contracts', 'HistoricalContractManagedLot')
    HistoricalContractManagedLot.objects.filter(route_info__isnull=True).update(route_info=False)


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0010_fix_route_info_null'),
    ]

    operations = [
        migrations.RunPython(backfill_historical_route_info, migrations.RunPython.noop),
    ]
