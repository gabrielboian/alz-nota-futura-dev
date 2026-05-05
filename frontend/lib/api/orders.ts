import { apiClient } from './client';
import type { Paginated } from './contracts';

export type SalesOrderStatus = 'pending' | 'in_progress' | 'closed' | 'paused' | 'invalidated';
export type SalesOrderRpaStatus =
  | 'awaiting_ov_creation'
  | 'executing'
  | 'completed'
  | 'error'
  | 'na'
  | 'awaiting_ov_quantity_update';
export type LoadingOrderStatus = 'active' | 'inactive';

export interface LoadingOrder {
  id: string;
  oc_number: string;
  sales_order: string;
  plate: string;
  weight_kg: string;
  status: LoadingOrderStatus;
  status_display: string;
  created_at: string;
  expires_at: string | null;
}

export interface SalesOrder {
  id: string;
  ov_number: string;
  external_rpa_id: string;
  managed_lot: string;
  ov_status: SalesOrderStatus;
  ov_status_display: string;
  rpa_status: SalesOrderRpaStatus;
  rpa_status_display: string;
  rpa_error_message: string;
  rpa_error_type: 'business_exception' | 'system_exception' | '';
  rpa_screenshot: string | null;
  rpa_last_attempt_at: string | null;
  rpa_retry_count: number;
  creation_event_datetime: string;
  total_quantity_kg: string;
  delivered_quantity_kg: string;
  balance_kg: string;
  cadence: string;
  freight_type_exit: string | null;
  freight_type_exit_name: string | null;
  harvest_year: string;
  product_sap_code: string;
  alternative_route: boolean;
  corridor: string | null;
  corridor_name: string | null;
  collection_point_code: string;
  freight_agent: string;
  billing_branch: string | null;
  billing_branch_name: string | null;
  transshipment_location: string | null;
  transshipment_location_name: string | null;
  terminal_destination: string | null;
  terminal_destination_name: string | null;
  rfl_value_kg: string;
  freight_value: string;
  billing_producer_name: string;
  client_state_registration: string;
  nf_future_delivery: string | null;
  nf_future_delivery_number: string | null;
  lot_number: string | null;
  producer_name: string | null;
  cpf_cnpj: string | null;
  product: string | null;
  released_at: string | null;
  order_index: number;
  closed_at: string | null;
  manually_created: boolean;
  original_order: string | null;
  invalidated_at: string | null;
  invalidated_by: string | null;
  is_invalidated: boolean;
  created_at: string;
  updated_at: string;
  loading_orders: LoadingOrder[];
}

export interface ListSalesOrdersParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  managed_lot?: string;
  ov_status?: SalesOrderStatus;
  rpa_status?: SalesOrderRpaStatus;
  has_rfl?: 'true' | 'false';
  product?: string;
  cpf_cnpj?: string;
  created_after?: string;
  created_before?: string;
}

export interface AlterSalesOrderPayload {
  transshipment_location: string | null;
  terminal_destination: string;
  rfl_value_kg: string | number;
  freight_value: string | number;
  billing_producer_name?: string;
  client_state_registration?: string;
  keep_loading_order_ids?: string[];
}

export const ordersApi = {
  listSalesOrders: async (params?: ListSalesOrdersParams) => {
    const response = await apiClient.get<Paginated<SalesOrder>>('/orders/sales-orders/', {
      params,
    });
    return response.data;
  },

  getSalesOrder: async (id: string) => {
    const response = await apiClient.get<SalesOrder>(`/orders/sales-orders/${id}/`);
    return response.data;
  },

  alter: async (id: string, payload: AlterSalesOrderPayload) => {
    const response = await apiClient.post<SalesOrder>(
      `/orders/sales-orders/${id}/alter/`,
      payload
    );
    return response.data;
  },

  increaseBalance: async (id: string, added_kg: string | number) => {
    const response = await apiClient.post<SalesOrder>(
      `/orders/sales-orders/${id}/increase-balance/`,
      { added_kg }
    );
    return response.data;
  },

  bulkRfl: async (ids: string[], rfl_value_kg: string | number) => {
    const response = await apiClient.post<{ updated: number }>(
      '/orders/sales-orders/bulk-rfl/',
      { ids, rfl_value_kg }
    );
    return response.data;
  },

  registerManual: async (payload: {
    managed_lot: string;
    ov_number: string;
    total_quantity_kg: string | number;
  }) => {
    const response = await apiClient.post<SalesOrder>(
      '/orders/sales-orders/register-manual/',
      payload
    );
    return response.data;
  },

  listLoadingOrders: async (params?: {
    sales_order?: string;
    status?: LoadingOrderStatus;
    page?: number;
    page_size?: number;
  }) => {
    const response = await apiClient.get<Paginated<LoadingOrder>>(
      '/orders/loading-orders/',
      { params }
    );
    return response.data;
  },
};
