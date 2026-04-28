"""URL routes for RPA callbacks.

Mounted under ``/api/v1/rpa/``.
"""
from rest_framework.routers import DefaultRouter

from .rpa_views import RPALoadingOrderViewSet, RPASalesOrderViewSet

router = DefaultRouter()
router.register('sales-orders', RPASalesOrderViewSet, basename='rpa-sales-order')
router.register('loading-orders', RPALoadingOrderViewSet, basename='rpa-loading-order')

urlpatterns = router.urls
