"""
Shared ALZ API client — authentication and base-URL management.

All services that talk to api.alzgraos.com.br use this module so there is
a single place to manage base URL, credential login, token caching
(55-minute TTL), and auto-refresh on 401.
"""
import logging

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

_CACHE_KEY = 'alz_api_access_token'
_CACHE_TTL_SECONDS = 55 * 60  # 55 minutes


def get_base_url() -> str:
    """Return the ALZ API base URL (no trailing slash)."""
    return getattr(
        settings, 'ALZ_API_BASE_URL', 'https://api.alzgraos.com.br'
    ).rstrip('/')


def _login() -> str:
    base_url = get_base_url()
    username = getattr(settings, 'ALZ_API_USERNAME', '')
    password = getattr(settings, 'ALZ_API_PASSWORD', '')

    if not username or not password:
        raise ValueError(
            'ALZ_API_USERNAME e ALZ_API_PASSWORD precisam estar configurados.'
        )

    auth_url = f'{base_url}/auth/token/'
    try:
        response = requests.post(
            auth_url,
            json={'username': username, 'password': password},
            timeout=15,
        )
    except requests.RequestException as exc:
        raise ValueError(f'Falha no login da ALZ API: {exc}') from exc

    if response.status_code != 200:
        raise ValueError(
            f'Login da ALZ API falhou ({response.status_code}): {response.text[:200]}'
        )

    token = response.json().get('access')
    if not token:
        raise ValueError('Resposta de login da ALZ API sem token "access".')

    cache.set(_CACHE_KEY, token, _CACHE_TTL_SECONDS)
    logger.info('ALZ API: novo access token obtido e cacheado por 55 min.')
    return token


def get_token(force_refresh: bool = False) -> str:
    """Return a valid ALZ API Bearer token (cached for 55 min)."""
    if force_refresh:
        cache.delete(_CACHE_KEY)
    else:
        cached = cache.get(_CACHE_KEY)
        if cached:
            return cached
    return _login()
