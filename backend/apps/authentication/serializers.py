"""
Authentication serializers for ALZ Nota Futura.

Contains serializers for:
- User profile
- Login (traditional and Microsoft OAuth)
- Password management (change, reset, force change)
- Internal roles
- User creation (admin only)
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import CustomUser, InternalUserRole
from .oauth_utils import verify_microsoft_token, get_or_create_oauth_user
from .email_service import generate_random_password, send_welcome_email, send_password_reset_email


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT token serializer that adds user information to token payload.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token['user_id'] = user.id
        token['username'] = user.username
        token['email'] = user.email
        token['full_name'] = user.get_full_name() or user.username

        token['user_type'] = user.user_type
        token['is_internal_staff'] = user.is_internal_staff

        token['force_password_change'] = user.force_password_change

        if user.is_internal_staff:
            internal_roles = user.internal_roles.filter(is_active=True).values_list('role', flat=True)
            token['internal_roles'] = list(internal_roles)
        else:
            token['internal_roles'] = []

        return token


class InternalUserRoleSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = InternalUserRole
        fields = ['id', 'role', 'role_display', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    user_type = serializers.CharField(read_only=True)
    has_oauth = serializers.BooleanField(read_only=True)
    has_password = serializers.BooleanField(read_only=True)
    needs_password_change = serializers.BooleanField(read_only=True)
    full_name = serializers.SerializerMethodField()
    internal_roles = InternalUserRoleSerializer(many=True, read_only=True)

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email

    class Meta:
        model = CustomUser
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'phone',
            'full_name',
            'user_type',
            'is_internal_staff',
            'is_superuser',
            'has_oauth',
            'has_password',
            'needs_password_change',
            'force_password_change',
            'microsoft_oauth_uid',
            'last_login',
            'last_login_ip',
            'date_joined',
            'is_active',
            'internal_roles',
        ]
        read_only_fields = [
            'id', 'username', 'user_type', 'is_internal_staff', 'is_superuser',
            'has_oauth', 'has_password', 'needs_password_change', 'force_password_change',
            'microsoft_oauth_uid', 'last_login', 'last_login_ip', 'date_joined',
            'is_active', 'internal_roles',
        ]


class LoginSerializer(serializers.Serializer):
    """Traditional username/email + password login."""

    username = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        username = attrs.get('username')
        email = attrs.get('email')
        password = attrs.get('password')

        if not username and not email:
            raise serializers.ValidationError(_('Must provide either username or email.'))

        user = None
        if email:
            try:
                user_obj = CustomUser.objects.get(email=email)
                username = user_obj.username
            except CustomUser.DoesNotExist:
                pass

        user = authenticate(username=username, password=password)

        if not user:
            raise serializers.ValidationError(_('Invalid credentials.'))

        if not user.is_active:
            raise serializers.ValidationError(_('User account is disabled.'))

        attrs['user'] = user
        return attrs

    def create(self, validated_data):
        user = validated_data['user']
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }


class MicrosoftOAuthSerializer(serializers.Serializer):
    """Microsoft OAuth login — accepts MS access token, returns JWT tokens."""

    access_token = serializers.CharField(write_only=True)

    def validate(self, attrs):
        access_token_str = attrs.get('access_token')
        microsoft_user_info = verify_microsoft_token(access_token_str)

        user = get_or_create_oauth_user(
            email=microsoft_user_info['email'],
            oauth_uid=microsoft_user_info['microsoft_id'],
            provider='microsoft',
            first_name=microsoft_user_info.get('first_name', ''),
            last_name=microsoft_user_info.get('last_name', '')
        )

        if not user.is_active:
            raise serializers.ValidationError(_('User account is disabled.'))

        attrs['user'] = user
        return attrs

    def create(self, validated_data):
        user = validated_data['user']
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }


class CreatePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        user = self.context['request'].user
        if user.has_usable_password():
            raise serializers.ValidationError(
                _('User already has a password. Use password change endpoint instead.')
            )
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': _('Passwords do not match.')})
        try:
            validate_password(attrs['new_password'], user)
        except ValidationError as e:
            raise serializers.ValidationError({'new_password': list(e.messages)})
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate_old_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError(_('Current password is incorrect.'))
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': _('Passwords do not match.')})
        try:
            validate_password(attrs['new_password'], self.context['request'].user)
        except ValidationError as e:
            raise serializers.ValidationError({'new_password': list(e.messages)})
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class ForcePasswordChangeSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        user = self.context['request'].user
        if not user.force_password_change:
            raise serializers.ValidationError(_('Password change is not required for this user.'))
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': _('Passwords do not match.')})
        try:
            validate_password(attrs['new_password'], user)
        except ValidationError as e:
            raise serializers.ValidationError({'new_password': list(e.messages)})
        return attrs

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.force_password_change = False
        user.save()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            user = CustomUser.objects.get(email=value, is_active=True)
            self.context['user'] = user
        except CustomUser.DoesNotExist:
            pass
        return value

    def save(self):
        user = self.context.get('user')
        if user:
            token = user.generate_password_reset_token()
            send_password_reset_email(user, token)


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        try:
            user = CustomUser.objects.get(password_reset_token=attrs['token'])
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError(_('Invalid or expired reset token.'))

        if not user.is_password_reset_token_valid():
            raise serializers.ValidationError(_('Reset token has expired.'))

        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': _('Passwords do not match.')})

        try:
            validate_password(attrs['new_password'], user)
        except ValidationError as e:
            raise serializers.ValidationError({'new_password': list(e.messages)})

        attrs['user'] = user
        return attrs

    def save(self):
        user = self.validated_data['user']
        user.set_password(self.validated_data['new_password'])
        user.clear_password_reset_token()
        user.save()
        return user


class UserCreateSerializer(serializers.ModelSerializer):
    """Admin-only: create a new internal user account."""

    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=InternalUserRole.ROLE_CHOICES),
        required=False,
        write_only=True
    )

    class Meta:
        model = CustomUser
        fields = [
            'email', 'first_name', 'last_name', 'phone',
            'is_internal_staff', 'is_active', 'password', 'roles',
        ]

    def create(self, validated_data):
        roles = validated_data.pop('roles', [])
        raw_password = validated_data.pop('password', None)

        email = validated_data['email']
        validated_data.setdefault('username', email)

        user = CustomUser(**validated_data)

        if raw_password:
            user.set_password(raw_password)
            user.force_password_change = True
        else:
            auto_password = generate_random_password()
            user.set_password(auto_password)
            user.force_password_change = True
            send_welcome_email(user, auto_password)

        user.save()

        for role in roles:
            InternalUserRole.objects.create(user=user, role=role)

        return user
