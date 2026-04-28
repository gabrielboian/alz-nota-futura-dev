"""Bot-facing routes (X-RPA-Token). Mounted under ``/api/v1/rpa/dispatch/``."""
from rest_framework.routers import DefaultRouter

from .views import RpaDispatchTaskBotViewSet

router = DefaultRouter()
router.register('tasks', RpaDispatchTaskBotViewSet, basename='rpa-dispatch-task-bot')

urlpatterns = router.urls
