"""
OAuth utility functions for Microsoft authentication.

Contains helper functions for:
- Microsoft token validation
- User information extraction
- User retrieval (users are admin-created only)
"""

import requests
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import CustomUser


def verify_microsoft_token(access_token_string):
    """
    Verify Microsoft access token and return user information.

    Args:
        access_token_string: The Microsoft access token from the frontend

    Returns:
        dict: User information containing:
            - email: User's email address
            - microsoft_id: User's Microsoft OAuth ID
            - first_name: User's first name
            - last_name: User's last name

    Raises:
        serializers.ValidationError: If token is invalid
    """
    try:
        graph_url = 'https://graph.microsoft.com/v1.0/me'
        headers = {
            'Authorization': f'Bearer {access_token_string}'
        }

        response = requests.get(graph_url, headers=headers, timeout=10)

        if response.status_code != 200:
            raise ValueError('Failed to get user info from Microsoft.')

        user_data = response.json()

        user_info = {
            'email': user_data.get('mail') or user_data.get('userPrincipalName'),
            'microsoft_id': user_data.get('id'),
            'first_name': user_data.get('givenName', ''),
            'last_name': user_data.get('surname', ''),
        }

        if not user_info['email']:
            raise ValueError('Email not provided by Microsoft.')

        if not user_info['microsoft_id']:
            raise ValueError('User ID not provided by Microsoft.')

        return user_info

    except ValueError as e:
        raise serializers.ValidationError(
            _(f'Invalid Microsoft token: {str(e)}')
        )
    except Exception:
        raise serializers.ValidationError(
            _('Failed to verify Microsoft token. Please try again.')
        )


def get_or_create_oauth_user(email, oauth_uid, provider, first_name='', last_name=''):
    """
    Link OAuth provider to an existing user account.

    Users are ONLY created by admins through the admin panel.
    OAuth login is only available to users who already have an account.

    Lookup order:
    1. Find by OAuth UID (already linked — fastest path)
    2. Find by email (first-time OAuth login — links the provider to the account)
    3. No user found → reject with a clear error message

    Args:
        email: User's email address from the OAuth provider
        oauth_uid: OAuth provider's unique ID
        provider: OAuth provider ('microsoft' only in this project)
        first_name: User's first name (optional, used to fill blank fields)
        last_name: User's last name (optional, used to fill blank fields)

    Returns:
        CustomUser: The existing user object

    Raises:
        serializers.ValidationError: If no account is found for the given email
    """
    if provider != 'microsoft':
        raise serializers.ValidationError(
            _('Unsupported OAuth provider.')
        )

    uid_field = 'microsoft_oauth_uid'

    # 1. Try to find user by OAuth UID (already linked previously)
    try:
        user = CustomUser.objects.get(**{uid_field: oauth_uid})

        # Keep email in sync if the user changed it on the provider
        if user.email != email:
            user.email = email
            user.save(update_fields=['email'])

        return user

    except CustomUser.DoesNotExist:
        pass

    # 2. Try to find user by email (first OAuth login — link provider to account)
    try:
        user = CustomUser.objects.get(email=email)

        # Link the OAuth provider to the existing account
        setattr(user, uid_field, oauth_uid)

        # Fill in missing name fields
        if not user.first_name and first_name:
            user.first_name = first_name
        if not user.last_name and last_name:
            user.last_name = last_name

        user.save()
        return user

    except CustomUser.DoesNotExist:
        pass

    # 3. No user found — reject
    raise serializers.ValidationError(
        _(
            'Nenhuma conta encontrada para este email. '
            'Por favor, entre em contato com o administrador do sistema.'
        )
    )
