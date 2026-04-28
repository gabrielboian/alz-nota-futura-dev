import { apiClient } from './client';
import type { Paginated } from './contracts';

export type RpaTaskType =
  | 'fiscal_instruction_email'
  | 'fiscal_instruction_whatsapp'
  | 'desk_manager_ticket';

export type RpaTaskStatus = 'pending' | 'in_progress' | 'completed' | 'error';

export type RpaRelatedType = 'fiscal_instruction' | 'sales_order' | 'shipment_request' | '';

export interface RpaDispatchTask {
  id: string;
  task_type: RpaTaskType;
  task_type_display: string;
  status: RpaTaskStatus;
  status_display: string;
  payload: Record<string, unknown>;
  related_object_type: RpaRelatedType;
  related_object_type_display: string;
  related_object_id: string | null;
  external_reference: string;
  error_message: string;
  retry_count: number;
  created_at: string;
  last_attempt_at: string | null;
  completed_at: string | null;
}

export interface ListRpaTasksParams {
  page?: number;
  page_size?: number;
  status?: RpaTaskStatus;
  task_type?: RpaTaskType;
  related_object_type?: RpaRelatedType;
  related_object_id?: string;
  search?: string;
  ordering?: string;
}

export const rpaTasksApi = {
  list: async (params?: ListRpaTasksParams) => {
    const response = await apiClient.get<Paginated<RpaDispatchTask>>(
      '/rpa-dispatch/tasks/',
      { params }
    );
    return response.data;
  },

  get: async (id: string) => {
    const response = await apiClient.get<RpaDispatchTask>(`/rpa-dispatch/tasks/${id}/`);
    return response.data;
  },

  requeue: async (id: string) => {
    const response = await apiClient.post<RpaDispatchTask>(
      `/rpa-dispatch/tasks/${id}/requeue/`
    );
    return response.data;
  },

  bulkRequeue: async (ids: string[]) => {
    const response = await apiClient.post<{ updated: number }>(
      '/rpa-dispatch/tasks/bulk_requeue/',
      { ids }
    );
    return response.data;
  },
};
