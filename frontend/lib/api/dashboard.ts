import { apiClient } from './client';

export interface DashboardContractsKPI {
  total: number;
  by_status: Record<string, number>;
  last_upload: {
    id: string;
    upload_date: string;
    status: string;
    row_count: number;
    error_count: number;
    user_email: string | null;
  } | null;
}

export interface DashboardSalesOrdersKPI {
  total: number;
  by_status: Record<string, number>;
  by_rpa_status: Record<string, number>;
  rpa_errors: number;
  awaiting_sap: number;
  open_balance_kg: string;
  delivered_last_24h_kg: string;
}

export interface DashboardNFKPI {
  total: number;
  by_status: Record<string, number>;
  total_quantity_kg: string;
  delivered_kg: string;
  remaining_kg: string;
  progress_pct: number;
  created_last_7d: number;
  in_progress_without_ov: number;
}

export interface DashboardShipmentsKPI {
  total: number;
  by_status: Record<string, number>;
  pending: number;
  approved_last_30d: number;
}

export interface DashboardKPIs {
  generated_at: string;
  contracts: DashboardContractsKPI;
  sales_orders: DashboardSalesOrdersKPI;
  nf_future_delivery: DashboardNFKPI;
  shipments: DashboardShipmentsKPI;
}

export const dashboardApi = {
  getKPIs: async () => {
    const response = await apiClient.get<DashboardKPIs>('/dashboard/kpis/');
    return response.data;
  },
};
