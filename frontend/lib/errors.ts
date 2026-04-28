/**
 * Normalizes API/network errors into a single PT-BR message string for the user.
 * Call this on every mutation/query error before displaying it.
 */

/**
 * Map of DRF serializer field names → PT-BR labels.
 *
 * Used to replace raw snake_case keys in validation errors with friendlier
 * labels in the UI. Extend as new fields surface in error messages.
 */
const FIELD_LABELS: Record<string, string> = {
  // Contracts / lotes
  lot_number: 'Nº do lote',
  lot_numbers: 'Nº dos lotes',
  base_lot: 'Lote base',
  managed_lot: 'Lote',
  contract_upload: 'Importação de contrato',
  product: 'Produto',
  harvest_year: 'Safra',
  branch: 'Filial',
  branch_name: 'Filial',
  origin_state: 'UF de origem',
  issuer_state: 'UF do emitente',
  destination: 'Destino',
  transshipment_point: 'Local de transbordo',
  destination_terminal: 'Terminal de destino',
  participant: 'Participante',
  corridor: 'Corredor',
  person_type: 'Tipo de pessoa',
  producer_name: 'Produtor',
  client_name: 'Cliente',
  cnpj: 'CNPJ',
  cpf: 'CPF',
  state_registration: 'Inscrição estadual',

  // Quantities / amounts
  quantity_kg: 'Quantidade (kg)',
  total_quantity_kg: 'Quantidade total (kg)',
  delivered_quantity_kg: 'Quantidade entregue (kg)',
  remaining_quantity_kg: 'Saldo restante (kg)',
  balance_kg: 'Saldo (kg)',

  // Prices / money
  unit_value: 'Valor unitário',
  gross_value: 'Valor bruto',
  freight_value: 'Valor do frete',
  executed_freight_value: 'Valor do frete executado',
  rfl_value_kg: 'Valor RFL (R$/kg)',
  rfl_value: 'Valor RFL',

  // NF EF
  nf_number: 'Nº da NF',
  nf_key: 'Chave da NF',
  nfe_key: 'Chave da NF-e',
  xml_file: 'Arquivo XML',
  pdf_file: 'Arquivo PDF',
  issue_date: 'Data de emissão',

  // OV / OC
  ov_number: 'Nº da OV',
  oc_number: 'Nº da OC',
  ov_status: 'Status da OV',
  rpa_status: 'Status do RPA',
  sales_order: 'Ordem de venda',
  loading_order: 'Ordem de carregamento',

  // Shipments
  shipment_date: 'Data do embarque',
  route_description: 'Rota',

  // Generic
  file: 'Arquivo',
  name: 'Nome',
  description: 'Descrição',
  email: 'E-mail',
  password: 'Senha',
  username: 'Usuário',
  status: 'Status',
  is_active: 'Ativo',
  non_field_errors: '',
  detail: '',
};

function labelFor(field: string): string {
  if (field in FIELD_LABELS) return FIELD_LABELS[field];
  // Fallback: replace underscores with spaces and capitalize first letter
  const spaced = field.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function flattenFieldValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(flattenFieldValue).join(' ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([, v]) => flattenFieldValue(v))
      .join(' ');
  }
  return typeof value === 'string' ? value : String(value ?? '');
}

export function getErrorMessage(err: unknown, fallback = 'Ocorreu um erro inesperado. Tente novamente.'): string {
  const anyErr = err as any;

  // Axios network error (no response)
  if (anyErr?.code === 'ERR_NETWORK' || anyErr?.message === 'Network Error') {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }
  if (anyErr?.code === 'ECONNABORTED') {
    return 'Tempo de resposta excedido. Tente novamente.';
  }

  const data = anyErr?.response?.data;
  const status = anyErr?.response?.status;

  if (data) {
    if (typeof data === 'string' && data.trim()) return data;
    if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
    if (typeof data.message === 'string' && data.message.trim()) return data.message;

    // DRF field errors: { field: ["msg", ...] }
    if (typeof data === 'object') {
      const parts: string[] = [];
      for (const [field, value] of Object.entries(data)) {
        const msg = flattenFieldValue(value).trim();
        if (!msg) continue;
        const label = labelFor(field);
        parts.push(label ? `${label}: ${msg}` : msg);
      }
      if (parts.length) return parts.join(' • ');
    }
  }

  if (status === 401) return 'Sessão expirada. Faça login novamente.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status === 404) return 'Recurso não encontrado.';
  if (status === 413) return 'Arquivo muito grande para upload.';
  if (status && status >= 500) return 'Erro no servidor. Tente novamente em instantes.';

  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message;
  return fallback;
}

