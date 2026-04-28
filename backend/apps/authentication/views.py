"""
Authentication views for ALZ Nota Futura.
"""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    UserSerializer,
    LoginSerializer,
    MicrosoftOAuthSerializer,
    CreatePasswordSerializer,
    PasswordChangeSerializer,
    ForcePasswordChangeSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    UserCreateSerializer,
)


class LoginView(APIView):
    """Traditional login with email/username and password. Returns JWT tokens."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.save()
        return Response(data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Logout user by blacklisting refresh token."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logout successful.'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'error': 'Invalid token.'}, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    """Get or update current user profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class MicrosoftOAuthView(APIView):
    """Microsoft OAuth login. Accepts MS access token, returns JWT tokens."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = MicrosoftOAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.save()
        return Response(data, status=status.HTTP_200_OK)


class CreatePasswordView(APIView):
    """Create password for OAuth-only users."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreatePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'message': 'Password created successfully. You can now login with email and password.'},
            status=status.HTTP_200_OK
        )


class PasswordChangeView(APIView):
    """Change password (requires current password)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


class ForcePasswordChangeView(APIView):
    """Force password change on first login (no old password required)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ForcePasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'message': 'Password changed successfully. You can now use all features.'},
            status=status.HTTP_200_OK
        )


class PasswordResetRequestView(APIView):
    """Request password reset. Sends email with reset link."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'message': 'If the email exists, a reset link has been sent.'},
            status=status.HTTP_200_OK
        )


class PasswordResetConfirmView(APIView):
    """Confirm password reset with token."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password reset successfully.'}, status=status.HTTP_200_OK)


class UserCreateView(APIView):
    """Create user account (admin only)."""
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserSerializer(user).data,
            status=status.HTTP_201_CREATED
        )
