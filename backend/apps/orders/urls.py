from rest_framework.routers import DefaultRouter

from .views import LoadingOrderViewSet, SalesOrderViewSet

router = DefaultRouter()
router.register('sales-orders', SalesOrderViewSet, basename='sales-order')
router.register('loading-orders', LoadingOrderViewSet, basename='loading-order')

urlpatterns = router.urls
