"""
OCR service — extracts a 44-digit NF-e key ("chave") from a PDF or image
(PNG/JPEG) via the ALZ external OCR API.

Endpoint: {ALZ_API_BASE_URL}/api/nfe-ocr/extract-key
"""
import logging
from typing import Dict

import requests

from .alz_api_client import get_base_url, get_token

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = ('pdf', 'jpg', 'jpeg', 'png')


def _endpoint() -> str:
    return f'{get_base_url()}/api/nfe-ocr/extract-key'


def _content_type(extension: str) -> str:
    if extension == 'pdf':
        return 'application/pdf'
    if extension in ('jpg', 'jpeg'):
        return 'image/jpeg'
    return f'image/{extension}'


def _call(file_obj, file_name: str, token: str) -> requests.Response:
    extension = file_name.lower().rsplit('.', 1)[-1]
    files = {'file': (file_name, file_obj, _content_type(extension))}
    headers = {'Authorization': f'Bearer {token}', 'accept': 'application/json'}
    data = {'token': f'Bearer {token}'}
    return requests.post(
        _endpoint(), headers=headers, files=files, data=data, timeout=30,
    )


def extract_nfe_key(file_obj, file_name: str) -> Dict:
    """Extract the 44-digit NF-e key from a PDF/PNG/JPEG file.

    Returns:
        {'success': True,  'chave': '17251...'} on success
        {'success': False, 'error': '...', 'status_code': N} on failure
    """
    extension = file_name.lower().rsplit('.', 1)[-1]
    if extension not in SUPPORTED_FORMATS:
        return {
            'success': False,
            'error': (
                f'Formato não suportado. Aceitos: {", ".join(SUPPORTED_FORMATS)}.'
            ),
        }

    try:
        token = get_token()
        response = _call(file_obj, file_name, token)

        if response.status_code == 401:
            logger.warning('OCR API 401 — renovando token e tentando novamente.')
            token = get_token(force_refresh=True)
            if hasattr(file_obj, 'seek'):
                file_obj.seek(0)
            response = _call(file_obj, file_name, token)

        return _parse_response(response)
    except ValueError as exc:
        logger.error(f'OCR: erro de configuração: {exc}')
        return {'success': False, 'error': str(exc)}
    except requests.Timeout:
        logger.error('OCR API timeout')
        return {'success': False, 'error': 'Timeout ao chamar a API de OCR.'}
    except requests.RequestException as exc:
        logger.error(f'OCR API request falhou: {exc}')
        return {'success': False, 'error': f'Falha na API de OCR: {exc}'}


def _parse_response(response: requests.Response) -> Dict:
    if response.status_code == 200:
        try:
            data = response.json()
            chave = data.get('key') if isinstance(data, dict) else data
        except Exception:
            chave = response.text.strip()

        chave_str = str(chave) if chave else ''
        if len(chave_str) == 44 and chave_str.isdigit():
            return {'success': True, 'chave': chave_str}
        logger.warning(f'OCR retornou chave inválida: {chave!r}')
        return {
            'success': False,
            'error': 'A API de OCR não retornou uma chave válida de 44 dígitos.',
        }

    if response.status_code == 422:
        return {
            'success': False,
            'error': 'Não foi possível identificar a chave no documento.',
            'status_code': 422,
        }
    if response.status_code == 413:
        return {'success': False, 'error': 'Arquivo muito grande.', 'status_code': 413}
    if response.status_code == 401:
        return {
            'success': False,
            'error': 'Autenticação com a API de OCR falhou.',
            'status_code': 401,
        }

    logger.error(f'OCR API erro {response.status_code}: {response.text[:200]}')
    return {
        'success': False,
        'error': f'Erro na API de OCR (HTTP {response.status_code}).',
        'status_code': response.status_code,
    }
