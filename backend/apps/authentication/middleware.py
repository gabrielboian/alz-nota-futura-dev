"""
Authentication middleware for ALZ Nota Futura.

ForcePasswordChangeMiddleware: Blocks access if user needs password change.
"""

from django.http import JsonResponse
from rest_framework import status


class ForcePasswordChangeMiddleware:
    """
    Middleware to enforce password change on first login.

    If user has force_password_change=True, blocks all requests except:
    - /api/v1/auth/password/force-change/
    - /api/v1/auth/logout/
    - /api/v1/auth/me/ (GET only)
    """

    ALLOWED_PATHS = [
        '/api/v1/auth/password/force-change/',
        '/api/v1/auth/logout/',
        '/api/v1/auth/token/refresh/',
    ]

    ALLOWED_GET_PATHS = [
        '/api/v1/auth/me/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            if hasattr(request.user, 'force_password_change') and request.user.force_password_change:
                if request.path in self.ALLOWED_PATHS:
                    return self.get_response(request)
                if request.path in self.ALLOWED_GET_PATHS and request.method == 'GET':
                    return self.get_response(request)
                return JsonResponse(
                    {
                        'error': 'password_change_required',
                        'message': 'You must change your password before accessing this resource.',
                        'detail': 'Please use /api/v1/auth/password/force-change/ to set a new password.'
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        return self.get_response(request)
