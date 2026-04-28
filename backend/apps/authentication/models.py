"""
Authentication models for ALZ Nota Futura.

Contains CustomUser and InternalUserRole models.
"""

from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
import uuid


class CustomUser(AbstractUser):
    """
    Custom user model extending Django's AbstractUser.

    Supports:
    - Traditional username/password authentication
    - OAuth2 (Microsoft) — can have Microsoft OAuth provider
    - Password management (change, reset, force change on first login)
    - User types (internal: ALZ staff with roles)

    Fields:
        email: Required, unique email address
        phone: Optional phone number
        is_internal_staff: Boolean flag for internal ALZ staff
        microsoft_oauth_uid: Unique Microsoft OAuth ID (nullable)
        force_password_change: Forces user to change password on next login
        password_changed_at: Timestamp of last password change
        password_reset_token: Token for password reset (UUID)
        password_reset_expires: Expiration time for reset token
        last_login_ip: IP address of last login
        is_active: User account status
    """

    # Contact Information
    email = models.EmailField(
        _('endereço de email'),
        unique=True,
        error_messages={
            'unique': _('Um usuário com este email já existe.'),
        }
    )
    phone = models.CharField(
        _('número de telefone'),
        null=True,
        blank=True,
        max_length=13,
        validators=[
            RegexValidator(
                r'^\d{13}$',
                _('Formato inválido. O telefone deve ter 13 dígitos (55 + DDD + 9 números).')
            )
        ]
    )

    # User Types
    is_internal_staff = models.BooleanField(
        _('equipe interna'),
        default=False,
        help_text=_('Designa se este usuário é da equipe interna da ALZ.')
    )

    # OAuth Integration
    microsoft_oauth_uid = models.CharField(
        _('UID OAuth Microsoft'),
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text=_('Identificador único do OAuth Microsoft')
    )

    # Password Management
    force_password_change = models.BooleanField(
        _('forçar mudança de senha'),
        default=False,
        help_text=_('Usuário deve alterar a senha no próximo login')
    )
    password_changed_at = models.DateTimeField(
        _('senha alterada em'),
        null=True,
        blank=True,
        help_text=_('Data e hora da última alteração de senha')
    )
    password_reset_token = models.UUIDField(
        _('token de redefinição de senha'),
        null=True,
        blank=True,
        help_text=_('Token para redefinição de senha')
    )
    password_reset_expires = models.DateTimeField(
        _('expiração do token de redefinição'),
        null=True,
        blank=True,
        help_text=_('Data e hora de expiração do token de redefinição de senha')
    )

    # Security & Tracking
    last_login_ip = models.GenericIPAddressField(
        _('IP do último login'),
        null=True,
        blank=True,
        help_text=_('Endereço IP do último login')
    )

    # Use email as the unique identifier for authentication
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']  # Required for createsuperuser, besides email

    class Meta:
        db_table = 'auth_users'
        verbose_name = _('Usuário')
        verbose_name_plural = _('Usuários')
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['username']),
            models.Index(fields=['microsoft_oauth_uid']),
            models.Index(fields=['is_active', 'is_internal_staff']),
        ]

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.email})"

    @property
    def user_type(self):
        """Return user type as string."""
        if self.is_internal_staff:
            return 'internal'
        return 'unknown'

    @property
    def has_oauth(self):
        """Check if user has any OAuth authentication."""
        return bool(self.microsoft_oauth_uid)

    @property
    def has_password(self):
        """Check if user has password authentication."""
        return self.has_usable_password()

    @property
    def needs_password_change(self):
        """Check if user needs to change password."""
        return self.force_password_change

    def generate_password_reset_token(self):
        """Generate a password reset token valid for 1 hour."""
        self.password_reset_token = uuid.uuid4()
        self.password_reset_expires = timezone.now() + timezone.timedelta(hours=1)
        self.save(update_fields=['password_reset_token', 'password_reset_expires'])
        return self.password_reset_token

    def is_password_reset_token_valid(self):
        """Check if password reset token is valid and not expired."""
        if not self.password_reset_token or not self.password_reset_expires:
            return False
        return timezone.now() < self.password_reset_expires

    def clear_password_reset_token(self):
        """Clear password reset token after use."""
        self.password_reset_token = None
        self.password_reset_expires = None
        self.save(update_fields=['password_reset_token', 'password_reset_expires'])

    def set_password(self, raw_password):
        """Override to track password change timestamp."""
        super().set_password(raw_password)
        if raw_password is not None:
            self.password_changed_at = timezone.now()
            self.force_password_change = False


class InternalUserRole(models.Model):
    """
    Internal user roles for ALZ staff.

    Defines roles for internal users:
    - COMERCIAL: Sales team, manages shipments and contracts
    - LOGISTICS: Logistics team, approves shipments
    - FISCAL: Fiscal team, manages NF instructions
    - ADMIN: System administrators with full access

    A user can have multiple roles.
    """

    ROLE_CHOICES = [
        ('COMERCIAL', 'Comercial'),
        ('LOGISTICS', 'Logística'),
        ('FISCAL', 'Fiscal'),
        ('ADMIN', 'Administrador'),
    ]

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='internal_roles',
        verbose_name=_('usuário')
    )
    role = models.CharField(
        _('perfil'),
        max_length=50,
        choices=ROLE_CHOICES
    )
    is_active = models.BooleanField(
        _('ativo'),
        default=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'auth_internal_user_roles'
        verbose_name = _('Perfil Interno')
        verbose_name_plural = _('Perfis Internos')
        unique_together = [('user', 'role')]

    def __str__(self):
        return f"{self.user.email} — {self.get_role_display()}"
