"""Admin-facing routes (JWT). Bot routes live in ``bot_urls``."""
from rest_framework.routers import DefaultRouter

from .views import RpaDispatchTaskAdminViewSet

router = DefaultRouter()
router.register('tasks', RpaDispatchTaskAdminViewSet, basename='rpa-dispatch-task')

urlpatterns = router.urls
