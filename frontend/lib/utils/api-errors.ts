/**
 * Parses a DRF API error response from an Axios error into a flat
 * Record keyed by the driver form's error state keys.
 *
 * DRF field names → UI error keys:
 *   full_name        → driver_name
 *   cpf              → driver_tax_id
 *   phone            → driver_phone
 *   cnh_number       → driver_cnh
 *   cnh_expiry_date  → driver_cnh_date
 *   anything else    → driver_general
 */

const DRIVER_FIELD_MAP: Record<string, string> = {
  full_name: 'driver_name',
  cpf: 'driver_tax_id',
  phone: 'driver_phone',
  cnh_number: 'driver_cnh',
  cnh_expiry_date: 'driver_cnh_date',
};

export function parseDriverApiErrors(error: any): Record<string, string> {
  const data = error?.response?.data;

  if (!data) {
    return { driver_general: error?.message || 'Erro ao cadastrar motorista' };
  }

  const result: Record<string, string> = {};

  for (const [field, messages] of Object.entries(data)) {
    const msg = Array.isArray(messages)
      ? (messages as string[]).join(' ')
      : String(messages);

    const key = DRIVER_FIELD_MAP[field];
    if (key) {
      result[key] = msg;
    } else {
      // detail, non_field_errors, error, or unknown server fields
      result.driver_general = result.driver_general
        ? `${result.driver_general} ${msg}`
        : msg;
    }
  }

  if (Object.keys(result).length === 0) {
    result.driver_general = 'Erro ao cadastrar motorista';
  }

  return result;
}
