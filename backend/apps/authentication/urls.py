"""
Authentication URL configuration.

Endpoints:
- POST /auth/login/ - Traditional login
- POST /auth/logout/ - Logout
- POST /auth/token/refresh/ - Refresh JWT token
- GET  /auth/me/ - Current user profile
- PATCH /auth/me/ - Update profile
- POST /auth/oauth/microsoft/ - Microsoft OAuth login
- POST /auth/password/create/ - Create password (for OAuth-only users)
- POST /auth/password/change/ - Change password
- POST /auth/password/force-change/ - Force password change
- POST /auth/password/reset/request/ - Request password reset
- POST /auth/password/reset/confirm/ - Confirm password reset
- POST /auth/users/create/ - Create user (admin only)
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView,
    LogoutView,
    CurrentUserView,
    MicrosoftOAuthView,
    CreatePasswordView,
    PasswordChangeView,
    ForcePasswordChangeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    UserCreateView,
)

app_name = 'authentication'

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('oauth/microsoft/', MicrosoftOAuthView.as_view(), name='oauth-microsoft'),
    path('password/create/', CreatePasswordView.as_view(), name='password-create'),
    path('password/change/', PasswordChangeView.as_view(), name='password-change'),
    path('password/force-change/', ForcePasswordChangeView.as_view(), name='force-password-change'),
    path('password/reset/request/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('users/create/', UserCreateView.as_view(), name='user-create'),
]
