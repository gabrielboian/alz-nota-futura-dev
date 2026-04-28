from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .dashboard_views import DashboardKPIView
from .lookup_views import (
    BranchViewSet,
    CommercialResponsibleViewSet,
    CorridorViewSet,
    FreightAgentListView,
    ParticipantViewSet,
    ProducerViewSet,
    TerminalDestinationViewSet,
    TipoFreteSaidaViewSet,
    TransportadoraALZTViewSet,
    TransportadoraViewSet,
    TransshipmentLocationViewSet,
)
from .views import health_check

router = DefaultRouter()
router.register(r'branches', BranchViewSet, basename='branch')
router.register(r'terminals', TerminalDestinationViewSet, basename='terminal')
router.register(r'transshipments', TransshipmentLocationViewSet, basename='transshipment')
router.register(r'participants', ParticipantViewSet, basename='participant')
router.register(r'commercial-responsibles', CommercialResponsibleViewSet, basename='commercial-responsible')
router.register(r'corridors', CorridorViewSet, basename='corridor')
router.register(r'producers', ProducerViewSet, basename='producer')
router.register(r'tipo-frete-saida', TipoFreteSaidaViewSet, basename='tipo-frete-saida')
router.register(r'transportadoras', TransportadoraViewSet, basename='transportadora')
router.register(r'transportadoras-alzt', TransportadoraALZTViewSet, basename='transportadora-alzt')

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('dashboard/kpis/', DashboardKPIView.as_view(), name='dashboard-kpis'),
    path('lookups/', include(router.urls)),
    path('lookups/freight-agents/', FreightAgentListView.as_view(), name='freight-agents'),
]
