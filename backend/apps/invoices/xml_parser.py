"""NFe XML parser for Nota Fiscal Entrega Futura uploads.

Extracts mother-NF fields from a Brazilian NFe XML v4.00 file. See docs
§7.6 "XML NF Parser" for the field mapping.

The parser is intentionally small and stdlib-only (xml.etree) so it does
not require a new dependency. It tolerates missing optional nodes, but
raises ValueError with a user-friendly PT-BR message when the XML is
structurally invalid or lacks mandatory data.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

_NS = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}

# "Lote: ABC123" / "Lote N° ABC-123" in infCpl observations
_LOT_IN_OBSERVATION_RE = re.compile(
    r'lote[^A-Z0-9]{0,6}([A-Z0-9][A-Z0-9\-\./]{1,29})', re.IGNORECASE
)


@dataclass
class ParsedNFe:
    nf_number: str = ''
    nf_key: str = ''
    issue_date: Optional[date] = None
    product: str = ''
    quantity_kg: Decimal = Decimal('0')
    unit_value: Decimal = Decimal('0')
    gross_value: Decimal = Decimal('0')
    producer_name: str = ''
    state_registration: str = ''
    issuer_state: str = ''
    lot_number: str = ''
    raw_observations: str = ''
    items: list[dict] = field(default_factory=list)


def _find_text(node: Optional[ET.Element], path: str) -> str:
    if node is None:
        return ''
    found = node.find(path, _NS)
    if found is None or found.text is None:
        return ''
    return found.text.strip()


def _to_decimal(raw: str) -> Decimal:
    if not raw:
        return Decimal('0')
    try:
        return Decimal(raw.replace(',', '.'))
    except (InvalidOperation, ValueError):
        return Decimal('0')


def _parse_issue_date(raw: str) -> Optional[date]:
    if not raw:
        return None
    # <dhEmi> in v4.00 is ISO with tz: 2025-03-10T14:23:05-03:00
    try:
        return datetime.fromisoformat(raw).date()
    except ValueError:
        pass
    # <dEmi> in older versions: 2025-03-10
    try:
        return datetime.strptime(raw[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def _extract_lot_from_observation(text: str) -> str:
    if not text:
        return ''
    match = _LOT_IN_OBSERVATION_RE.search(text)
    return match.group(1).strip() if match else ''


def parse_nfe_xml(content: bytes | str) -> ParsedNFe:
    """Parse an NFe XML payload and return structured data.

    Raises ValueError with a PT-BR message if the XML is malformed or
    missing mandatory fields (nNF / chave).
    """
    try:
        if isinstance(content, bytes):
            root = ET.fromstring(content)
        else:
            root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise ValueError(f'XML inválido: {exc}') from exc

    # Accept root <nfeProc> (signed) or <NFe> (unsigned).
    nfe = root.find('.//nfe:NFe', _NS) or (root if root.tag.endswith('NFe') else None)
    if nfe is None:
        raise ValueError('XML não contém um elemento <NFe>.')

    inf_nfe = nfe.find('nfe:infNFe', _NS)
    if inf_nfe is None:
        raise ValueError('XML não contém <infNFe>.')

    out = ParsedNFe()

    # Chave NF: "NFe" prefix + 44 digits in Id attribute.
    inf_id = inf_nfe.attrib.get('Id', '')
    if inf_id.startswith('NFe') and len(inf_id) == 47:
        out.nf_key = inf_id[3:]
    else:
        # Fallback: protNFe/infProt/chNFe
        out.nf_key = _find_text(root, './/nfe:protNFe/nfe:infProt/nfe:chNFe')

    ide = inf_nfe.find('nfe:ide', _NS)
    out.nf_number = _find_text(ide, 'nfe:nNF')
    out.issue_date = _parse_issue_date(
        _find_text(ide, 'nfe:dhEmi') or _find_text(ide, 'nfe:dEmi')
    )

    emit = inf_nfe.find('nfe:emit', _NS)
    out.producer_name = _find_text(emit, 'nfe:xNome')
    out.state_registration = _find_text(emit, 'nfe:IE')
    out.issuer_state = _find_text(emit, 'nfe:enderEmit/nfe:UF')

    if not out.nf_number:
        raise ValueError('XML sem número de NF (<nNF>).')
    if not out.nf_key:
        raise ValueError('XML sem chave de acesso (<chNFe> / infNFe@Id).')

    # Items: sum quantities; use first item for product/unit value.
    total_qty = Decimal('0')
    total_gross = Decimal('0')
    first_product = ''
    first_unit_value = Decimal('0')

    for det in inf_nfe.findall('nfe:det', _NS):
        prod = det.find('nfe:prod', _NS)
        if prod is None:
            continue
        xprod = _find_text(prod, 'nfe:xProd')
        qcom = _to_decimal(_find_text(prod, 'nfe:qCom'))
        vuncom = _to_decimal(_find_text(prod, 'nfe:vUnCom'))
        vprod = _to_decimal(_find_text(prod, 'nfe:vProd'))
        if not first_product:
            first_product = xprod
            first_unit_value = vuncom
        total_qty += qcom
        total_gross += vprod
        out.items.append({
            'product': xprod,
            'quantity': qcom,
            'unit_value': vuncom,
            'gross_value': vprod,
        })

    out.product = first_product
    out.unit_value = first_unit_value
    out.quantity_kg = total_qty
    out.gross_value = total_gross or _to_decimal(
        _find_text(inf_nfe, 'nfe:total/nfe:ICMSTot/nfe:vNF')
    )

    # Lot number heuristics:
    # 1) xPed (purchase order ref) on first det
    # 2) "Lote: X" inside infAdic/infCpl
    first_det = inf_nfe.find('nfe:det', _NS)
    xped = _find_text(first_det, 'nfe:prod/nfe:xPed') if first_det is not None else ''
    if xped:
        out.lot_number = xped.strip()[:30]

    inf_cpl = _find_text(inf_nfe, 'nfe:infAdic/nfe:infCpl')
    out.raw_observations = inf_cpl
    if not out.lot_number and inf_cpl:
        out.lot_number = _extract_lot_from_observation(inf_cpl)[:30]

    return out
