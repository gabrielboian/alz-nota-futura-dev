"""
NF-e XML fetch service — retrieves the XML of an NF-e by its 44-digit
key via the ALZ XML-SAP API.

Endpoint: {ALZ_API_BASE_URL}/api/buscar-nf/
"""
import json
import logging
import xml.etree.ElementTree as ET
from typing import Dict

import requests

from .alz_api_client import get_base_url, get_token

logger = logging.getLogger(__name__)


def _endpoint() -> str:
    return f'{get_base_url()}/api/buscar-nf/'


def _is_valid_key(nfe_key: str) -> bool:
    return bool(nfe_key) and len(nfe_key) == 44 and nfe_key.isdigit()


def _do_request(nfe_key: str, token: str) -> requests.Response:
    payload = {
        'token': f'Bearer {token}',
        'chave': nfe_key,
        'tipo': 'XML',
    }
    return requests.post(
        _endpoint(),
        headers={'Content-Type': 'application/json'},
        data=json.dumps(payload),
        timeout=30,
    )


def fetch_xml_by_key(nfe_key: str) -> Dict:
    """Fetch the XML content of an NF-e from the XML-SAP API by its key.

    Returns:
        {'success': True,  'xml': '<nfeProc>...'}  on success
        {'success': False, 'error': '...', 'status_code': N} on failure
    """
    if not _is_valid_key(nfe_key):
        return {
            'success': False,
            'error': 'Chave de NF-e inválida — precisa ter 44 dígitos numéricos.',
        }

    try:
        token = get_token()
    except ValueError as exc:
        return {'success': False, 'error': str(exc)}

    try:
        response = _do_request(nfe_key, token)
        if response.status_code == 401:
            logger.warning('XML-SAP 401 — renovando token e tentando novamente.')
            token = get_token(force_refresh=True)
            response = _do_request(nfe_key, token)
    except requests.Timeout:
        return {'success': False, 'error': 'Timeout ao buscar o XML na API SAP.'}
    except requests.RequestException as exc:
        return {'success': False, 'error': f'Falha ao chamar a API SAP: {exc}'}

    return _parse_response(response, nfe_key)


def _parse_response(response: requests.Response, nfe_key: str) -> Dict:
    if response.status_code == 200:
        content = response.text
        xml_content = content

        try:
            json_data = response.json()
            if isinstance(json_data, str):
                xml_content = json_data
            elif isinstance(json_data, dict):
                xml_content = json_data.get('xml', json_data.get('data', content))
        except (ValueError, AttributeError):
            xml_content = content

        try:
            ET.fromstring(xml_content)
        except ET.ParseError as exc:
            logger.error(f'XML inválido vindo da API SAP: {exc}')
            return {'success': False, 'error': 'XML retornado pela API SAP é inválido.'}

        return {'success': True, 'xml': xml_content}

    if response.status_code == 404:
        return {
            'success': False,
            'error': f'NF-e {nfe_key} não encontrada na API SAP.',
            'status_code': 404,
        }
    if response.status_code == 422:
        return {
            'success': False,
            'error': 'Chave inválida ou parâmetros incorretos.',
            'status_code': 422,
        }
    if response.status_code == 401:
        return {
            'success': False,
            'error': 'Autenticação com a API SAP falhou.',
            'status_code': 401,
        }

    logger.error(f'XML-SAP erro {response.status_code}: {response.text[:200]}')
    return {
        'success': False,
        'error': f'Erro na API SAP (HTTP {response.status_code}).',
        'status_code': response.status_code,
    }
