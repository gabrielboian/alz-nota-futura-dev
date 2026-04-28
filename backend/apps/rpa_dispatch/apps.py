from django.apps import AppConfig


class RpaDispatchConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.rpa_dispatch'
    verbose_name = 'Disparos RPA'

    def ready(self):
        from . import signals  # noqa: F401
