import { apiClient } from './client';
import type { Paginated } from './contracts';

export type ShipmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ShipmentRequest {
  id: string;
  managed_lot: string;
  lot_number: string;
  producer_name: string;
  requested_by: string | null;
  requested_by_email: string | null;
  approved_by: string | null;
  approved_by_email: string | null;
  status: ShipmentStatus;
  status_display: string;
  desk_manager_ticket_id: string;
  requested_at: string;
  approved_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateShipmentRequestPayload {
  managed_lot: string;
  notes?: string;
}

export interface ListShipmentRequestsParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  status?: ShipmentStatus;
}

export const shipmentsApi = {
  list: async (params?: ListShipmentRequestsParams) => {
    const response = await apiClient.get<Paginated<ShipmentRequest>>(
      '/shipments/requests/',
      { params }
    );
    return response.data;
  },

  get: async (id: string) => {
    const response = await apiClient.get<ShipmentRequest>(`/shipments/requests/${id}/`);
    return response.data;
  },

  create: async (payload: CreateShipmentRequestPayload) => {
    const response = await apiClient.post<ShipmentRequest>('/shipments/requests/', payload);
    return response.data;
  },

  approve: async (id: string) => {
    const response = await apiClient.post<ShipmentRequest>(`/shipments/requests/${id}/approve/`);
    return response.data;
  },

  reject: async (id: string, notes?: string) => {
    const response = await apiClient.post<ShipmentRequest>(
      `/shipments/requests/${id}/reject/`,
      { notes }
    );
    return response.data;
  },

  cancel: async (id: string) => {
    await apiClient.delete(`/shipments/requests/${id}/`);
  },
};
