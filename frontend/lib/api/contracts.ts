import { apiClient } from './client';

export interface ContractBaseLot {
  id: string;
  lot_number: string;
  producer_name: string;
  cpf_cnpj: string;
  product: string;
  product_type: string;
  branch_name: string;
  city: string;
  state_code: string;
  load_city: string;
  load_state: string;
  load_location: string;
  address_code: string;
  quantity_kg: string;
  delivered_kg: string;
  remaining_kg: string;
  balance: string;
  freight_type: string;
  freight_value: string;
  unit_value: string;
  payment_date: string | null;
  delivery_start_date: string | null;
  delivery_end_date: string | null;
  upload: string;
  created_at: string;
  updated_at: string;
}

export interface ContractManagedLot {
  id: string;
  base_lot: string;
  base_lot_data?: ContractBaseLot;
  status: string;
  status_display: string;
  shipment_released: boolean;

  // Portal fields (writeable via PATCH)
  commercial_responsible: string | null;
  harvest_year: string;
  pickup_location: string;
  loading_site: string;
  collection_point_code: string;
  loading_state_registration: string;
  freight_type_exit: string | null;
  region: string;
  phone: string;
  email: string;
  route_description: string;

  scale_over_25m: boolean;
  silo_bag_loading: boolean;
  has_transshipment: boolean;
  transshipment_location: string | null;
  terminal_destination: string | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;

  has_participant: boolean;
  participant: string | null;
  delivered_by_holder: boolean;

  billing_producer_name: string;
  client_state_registration: string;
  cnpj_billing: string;
  commercial_responsible_name: string;

  rfl_value_kg: string;
  rfl_value_sack: string;
  executed_freight_value: string;
  corridor: string | null;
  freight_agent: string;
  scheduling: string;
  route_info: boolean;

  billing_branch: string | null;
  has_nf_future_delivery: boolean;
  nf_key_future_delivery: string;

  // Read-only computed
  cif_freight_agent_code: string;

  released_at: string | null;
  released_by: string | null;

  created_at: string;
  updated_at: string;
}

/** Portal-editable subset of `ContractManagedLot` — matches backend MANAGED_LOT_PORTAL_FIELDS. */
export type ContractManagedLotUpdate = Partial<{
  commercial_responsible: string | null;
  harvest_year: string;
  pickup_location: string;
  loading_site: string;
  collection_point_code: string;
  loading_state_registration: string;
  freight_type_exit: string | null;
  region: string;
  phone: string;
  email: string;
  route_description: string;
  scale_over_25m: boolean;
  silo_bag_loading: boolean;
  has_transshipment: boolean;
  transshipment_location: string | null;
  terminal_destination: string | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  has_participant: boolean;
  participant: string | null;
  delivered_by_holder: boolean;
  billing_producer_name: string;
  client_state_registration: string;
  cnpj_billing: string;
  commercial_responsible_name: string;
  rfl_value_kg: string | number;
  executed_freight_value: string | number;
  corridor: string | null;
  freight_agent: string;
  scheduling: string;
  route_info: boolean;
  billing_branch: string | null;
  has_nf_future_delivery: boolean;
  nf_key_future_delivery: string;
}>;

export interface ContractUpload {
  id: string;
  upload_date: string;
  status: 'processing' | 'success' | 'error';
  observations: string;
  user: string | null;
  user_email: string | null;
  file: string;
  row_count: number;
  error_count: number;
}

export interface UploadResponse extends ContractUpload {
  rows_created: number;
  rows_updated: number;
  rows_errored: number;
  errors_sample: string[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const contractsApi = {
  listBaseLots: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    ordering?: string;
  }) => {
    const response = await apiClient.get<Paginated<ContractBaseLot>>(
      '/contracts/base-lots/',
      { params }
    );
    return response.data;
  },

  listManagedLots: async (params?: { page?: number; page_size?: number; search?: string; ordering?: string; status?: string; lot_number?: string; producer_name?: string; harvest_year?: string; product?: string }) => {
    const response = await apiClient.get<Paginated<ContractManagedLot>>(
      '/contracts/lots/',
      { params }
    );
    return response.data;
  },

  getManagedLot: async (id: string) => {
    const response = await apiClient.get<ContractManagedLot>(`/contracts/lots/${id}/`);
    return response.data;
  },

  updateManagedLot: async (id: string, payload: ContractManagedLotUpdate) => {
    const response = await apiClient.patch<ContractManagedLot>(
      `/contracts/lots/${id}/`,
      payload
    );
    return response.data;
  },

  splitManagedLot: async (
    id: string,
    splits: { lot_number: string; quantity_kg: string; producer_name?: string }[]
  ) => {
    const response = await apiClient.post<{
      original_managed_lot_id: string;
      original_status: string;
      created_managed_lot_ids: string[];
    }>(`/contracts/lots/${id}/split/`, { splits });
    return response.data;
  },

  listUploads: async () => {
    const response = await apiClient.get<Paginated<ContractUpload>>('/contracts/uploads/');
    return response.data;
  },

  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<UploadResponse>(
      '/contracts/uploads/',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },
};
