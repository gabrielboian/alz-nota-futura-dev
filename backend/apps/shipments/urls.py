from rest_framework.routers import DefaultRouter

from .views import ShipmentRequestViewSet

router = DefaultRouter()
router.register('requests', ShipmentRequestViewSet, basename='shipment-request')

urlpatterns = router.urls
