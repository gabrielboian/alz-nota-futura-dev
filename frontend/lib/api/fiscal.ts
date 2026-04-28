import { apiClient } from './client';
import type { Paginated } from './contracts';

export type PersonType = 'PF' | 'PJ';

export interface FiscalInstruction {
  id: string;
  branch: string;
  branch_name: string;
  harvest_year: string;
  product: string;
  person_type: PersonType;
  person_type_display: string;
  issuer_state: string;
  has_nf_future_delivery: boolean;
  instruction_name: string;
  instruction_text: string;
  destination: string;
  freight_value: string;
  route_description: string;
  client_name: string;
  pdf_file: string | null;
  pdf_file_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListFiscalInstructionsParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  branch?: string;
  harvest_year?: string;
  product?: string;
  person_type?: PersonType;
  issuer_state?: string;
  is_active?: boolean;
}

export interface MatchFiscalInstructionParams {
  branch: string;
  harvest_year: string;
  product: string;
  person_type: PersonType;
  issuer_state: string;
  has_nf_future_delivery: boolean;
}

export type FiscalInstructionPayload = Omit<
  FiscalInstruction,
  'id' | 'branch_name' | 'person_type_display' | 'created_at' | 'updated_at'
>;

export const fiscalApi = {
  list: async (params?: ListFiscalInstructionsParams) => {
    const response = await apiClient.get<Paginated<FiscalInstruction>>(
      '/fiscal/instructions/',
      { params }
    );
    return response.data;
  },

  get: async (id: string) => {
    const response = await apiClient.get<FiscalInstruction>(`/fiscal/instructions/${id}/`);
    return response.data;
  },

  create: async (payload: Partial<FiscalInstructionPayload>) => {
    const response = await apiClient.post<FiscalInstruction>(
      '/fiscal/instructions/',
      payload
    );
    return response.data;
  },

  update: async (id: string, payload: Partial<FiscalInstructionPayload>) => {
    const response = await apiClient.patch<FiscalInstruction>(
      `/fiscal/instructions/${id}/`,
      payload
    );
    return response.data;
  },

  remove: async (id: string) => {
    await apiClient.delete(`/fiscal/instructions/${id}/`);
  },

  match: async (params: MatchFiscalInstructionParams) => {
    const response = await apiClient.get<FiscalInstruction>(
      '/fiscal/instructions/match/',
      { params }
    );
    return response.data;
  },

  downloadDocument: async (id: string) => {
    const response = await apiClient.get<Blob>(
      `/fiscal/instructions/${id}/download/`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  dispatch: async (
    id: string,
    body?: {
      channels?: Array<'email' | 'whatsapp'>;
      recipients?: { emails?: string[]; phones?: string[] };
      notes?: string;
    }
  ) => {
    const response = await apiClient.post<{ enqueued: string[]; count: number }>(
      `/fiscal/instructions/${id}/dispatch/`,
      body ?? {}
    );
    return response.data;
  },
};
