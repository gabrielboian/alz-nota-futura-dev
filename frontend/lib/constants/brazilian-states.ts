/**
 * Brazilian States Constants
 *
 * All 26 Brazilian states plus the Federal District
 * Can be used across the application for forms, filters, etc.
 */

export interface BrazilianState {
  code: string;
  name: string;
}

export const BRAZILIAN_STATES: BrazilianState[] = [
  // { code: 'AC', name: 'Acre' },
  // { code: 'AL', name: 'Alagoas' },
  // { code: 'AP', name: 'Amapá' },
  // { code: 'AM', name: 'Amazonas' },
  // { code: 'BA', name: 'Bahia' },
  // { code: 'CE', name: 'Ceará' },
  // { code: 'DF', name: 'Distrito Federal' },
  // { code: 'ES', name: 'Espírito Santo' },
  // { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  // { code: 'MT', name: 'Mato Grosso' },
  // { code: 'MS', name: 'Mato Grosso do Sul' },
  // { code: 'MG', name: 'Minas Gerais' },
  // { code: 'PA', name: 'Pará' },
  // { code: 'PB', name: 'Paraíba' },
  // { code: 'PR', name: 'Paraná' },
  // { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  // { code: 'RJ', name: 'Rio de Janeiro' },
  // { code: 'RN', name: 'Rio Grande do Norte' },
  // { code: 'RS', name: 'Rio Grande do Sul' },
  // { code: 'RO', name: 'Rondônia' },
  // { code: 'RR', name: 'Roraima' },
  // { code: 'SC', name: 'Santa Catarina' },
  // { code: 'SP', name: 'São Paulo' },
  // { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
];

/**
 * Get state name by code
 */
export function getStateName(code: string): string {
  const state = BRAZILIAN_STATES.find(s => s.code === code);
  return state?.name || code;
}

/**
 * Get state code by name
 */
export function getStateCode(name: string): string {
  const state = BRAZILIAN_STATES.find(s => s.name.toLowerCase() === name.toLowerCase());
  return state?.code || name;
}
