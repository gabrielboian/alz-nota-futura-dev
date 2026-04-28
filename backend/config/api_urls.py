from django.urls import path, include

urlpatterns = [
    path('', include('apps.core.urls')),
    path('auth/', include('apps.authentication.urls', namespace='authentication')),
    path('contracts/', include('apps.contracts.urls')),
    path('shipments/', include('apps.shipments.urls')),
    path('orders/', include('apps.orders.urls')),
    path('invoices/', include('apps.invoices.urls')),
    path('fiscal/', include('apps.fiscal.urls')),
    path('dashboard/', include('apps.dashboard.urls')),
    path('rpa/', include('apps.orders.rpa_urls')),
    path('rpa/dispatch/', include('apps.rpa_dispatch.bot_urls')),
    path('rpa-dispatch/', include('apps.rpa_dispatch.urls')),
]
