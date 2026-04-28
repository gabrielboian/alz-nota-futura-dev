"""URL routes for fiscal app."""
from rest_framework.routers import DefaultRouter

from .views import FiscalInstructionViewSet

router = DefaultRouter()
router.register(r'instructions', FiscalInstructionViewSet, basename='fiscal-instruction')

urlpatterns = router.urls
