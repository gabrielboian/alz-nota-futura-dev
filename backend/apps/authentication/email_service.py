"""
Email service for authentication-related emails.
"""

import logging
import string
import secrets
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def generate_random_password(length=12):
    """Generate a secure random password."""
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = '!@#$%&*'

    password = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    all_chars = uppercase + lowercase + digits + special
    password += [secrets.choice(all_chars) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(password)

    return ''.join(password)


def send_welcome_email(user, password):
    """Send welcome email with auto-generated password to new user."""
    subject = 'ALZ Nota Futura - Bem-vindo! Suas credenciais de acesso'
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

    message = (
        f'Olá {user.get_full_name() or user.email},\n\n'
        f'Sua conta no portal ALZ Nota Futura foi criada.\n\n'
        f'Email: {user.email}\n'
        f'Senha temporária: {password}\n\n'
        f'Acesse: {frontend_url}/login\n\n'
        f'Por segurança, você será solicitado a alterar sua senha no primeiro acesso.\n\n'
        f'Atenciosamente,\nEquipe ALZ Grãos'
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
        return True
    except Exception as e:
        logger.error(f'Failed to send welcome email to {user.email}: {e}')
        return False


def send_password_reset_email(user, token):
    """Send password reset email with reset link."""
    subject = 'ALZ Nota Futura - Redefinição de senha'
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    reset_url = f'{frontend_url}/reset-password?token={token}'

    message = (
        f'Olá {user.get_full_name() or user.email},\n\n'
        f'Recebemos uma solicitação de redefinição de senha para sua conta.\n\n'
        f'Acesse o link abaixo para criar uma nova senha (válido por 1 hora):\n'
        f'{reset_url}\n\n'
        f'Se não foi você quem solicitou, ignore este email.\n\n'
        f'Atenciosamente,\nEquipe ALZ Grãos'
    )

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
        return True
    except Exception as e:
        logger.error(f'Failed to send password reset email to {user.email}: {e}')
        return False
