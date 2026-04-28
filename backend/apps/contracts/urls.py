from rest_framework.routers import DefaultRouter

from .views import ContractBaseLotViewSet, ContractManagedLotViewSet, ContractUploadViewSet

router = DefaultRouter()
router.register('uploads', ContractUploadViewSet, basename='contract-upload')
router.register('base-lots', ContractBaseLotViewSet, basename='contract-base-lot')
router.register('lots', ContractManagedLotViewSet, basename='contract-managed-lot')

urlpatterns = router.urls
