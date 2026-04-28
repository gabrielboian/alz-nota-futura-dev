from rest_framework.routers import DefaultRouter

from .views import (
    ChildNFBotViewSet,
    ChildNFViewSet,
    NFFutureDeliveryBotViewSet,
    NFFutureDeliveryViewSet,
    NFValidationErrorViewSet,
)

router = DefaultRouter()
router.register('future-delivery', NFFutureDeliveryViewSet, basename='nf-future-delivery')
router.register('child-nfs', ChildNFViewSet, basename='child-nf')
router.register(
    'validation-errors', NFValidationErrorViewSet, basename='nf-validation-error'
)
router.register('bot/child-nfs', ChildNFBotViewSet, basename='child-nf-bot')
router.register(
    'bot/future-delivery', NFFutureDeliveryBotViewSet, basename='nf-future-delivery-bot'
)

urlpatterns = router.urls
