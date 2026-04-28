import { apiClient } from './client';
import type { Paginated } from './contracts';

export interface Branch {
  id: string;
  sap_code: string;
  description: string;
  state: string;
  cnpj: string;
  type: string;
  cif_transportadora_code: string;
}

export interface TerminalDestination {
  id: string;
  name: string;
  sap_client_code: string;
  sap_supplier_code: string;
  is_transshipment: boolean;
  customs_facility_code: string;
}

export interface TransshipmentLocation {
  id: string;
  name: string;
  branch: string | null;
  branch_sap_code: string;
}

export interface Participant {
  id: string;
  name: string;
  sap_code: string;
  inscricao_estadual: string;
  cnpj: string;
}

export interface CommercialResponsible {
  id: string;
  name: string;
  state: string;
  branch: string | null;
  corporate_phone: string;
  email: string;
}

export interface Corridor {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface TipoFreteSaida {
  id: string;
  name: string;
}

export interface Transportadora {
  id: string;
  code: string;
  name: string;
  state: string;
  cnpj: string;
  phone: string;
  email: string;
}

/** Unified freight agent — can be a third-party Transportadora or an ALZ subsidiary (ALZT). */
export interface FreightAgent {
  /** SAP code (unique across the merged list). */
  code: string;
  name: string;
  state: string;
  cnpj: string;
  /** Origin model: 'transportadora' | 'alzt' */
  source: 'transportadora' | 'alzt';
}

export interface Producer {
  id: string;
  name: string;
  cpf_cnpj: string;
}

async function listAll<T>(path: string, params?: Record<string, string>) {
  const res = await apiClient.get<T[]>(path, { params });
  return res.data;
}

export const lookupsApi = {
  branches: () => listAll<Branch>('/lookups/branches/'),
  terminals: () => listAll<TerminalDestination>('/lookups/terminals/'),
  transshipments: () => listAll<TransshipmentLocation>('/lookups/transshipments/'),
  participants: (search?: string) =>
    listAll<Participant>('/lookups/participants/', search ? { search } : undefined),
  commercialResponsibles: () =>
    listAll<CommercialResponsible>('/lookups/commercial-responsibles/'),
  corridors: () => listAll<Corridor>('/lookups/corridors/'),
  tipoFreteSaida: () => listAll<TipoFreteSaida>('/lookups/tipo-frete-saida/'),
  transportadoras: (search?: string) =>
    listAll<Transportadora>('/lookups/transportadoras/', search ? { search } : undefined),
  freightAgents: (search?: string) =>
    listAll<FreightAgent>('/lookups/freight-agents/', search ? { search } : undefined),
  createTransportadora: async (data: { code: string; name: string; state?: string }) => {
    const res = await apiClient.post<Transportadora>('/lookups/transportadoras/', data);
    return res.data;
  },
  listProducers: async (params: { page?: number; page_size?: number; search?: string } = {}) => {
    const res = await apiClient.get<Paginated<Producer>>('/lookups/producers/', { params });
    return res.data;
  },
  createProducer: async (name: string) => {
    const res = await apiClient.post<Producer>('/lookups/producers/', { name });
    return res.data;
  },
};
