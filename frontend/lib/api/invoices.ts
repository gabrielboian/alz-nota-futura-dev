import { apiClient } from './client';
import type { Paginated } from './contracts';

export type NFFutureDeliveryStatus = 'in_progress' | 'finished';

export type ChildNFValidationStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'needs_review';

export interface ChildrenSummary {
  total: number;
  valid: number;
  invalid: number;
  pending: number;
  needs_review: number;
}

export interface ChildNF {
  id: string;
  mother_nf: string | null;
  mother_nf_number: string | null;
  nf_number: string;
  nf_key: string;
  serie: string;
  issue_date: string | null;
  emitter_cnpj: string;
  emitter_state_registration: string;
  quantity_kg: string;
  unit_value: string;
  validation_level: number | null;
  validation_status: ChildNFValidationStatus;
  validation_status_display: string;
  validation_error: string | null;
  validation_error_code: string | null;
  validation_error_message: string | null;
  validation_detail: string;
  validated_at: string | null;
  has_correction_letter: boolean;
  correction_new_mother_ref: string;
  created_at: string;
  updated_at: string;
}

export interface NFValidationErrorCatalog {
  code: string;
  level: number;
  message_pt: string;
  detail_pt: string;
  recommended_action: string;
}

export interface NFFutureDelivery {
  id: string;
  nf_number: string;
  nf_key: string;
  quantity_kg: string;
  unit_value: string;
  gross_value: string;
  branch_name: string;
  product: string;
  harvest_year: string;
  issue_date: string | null;
  sap_code: string;
  state_registration: string;
  lot_number: string;
  producer_name: string;
  status: NFFutureDeliveryStatus;
  status_display: string;
  delivered_quantity_kg: string;
  remaining_quantity_kg: string;
  xml_file: string | null;
  children_summary: ChildrenSummary;
  created_at: string;
  updated_at: string;
}

export interface ListNFFutureDeliveryParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  lot_number?: string;
  status?: NFFutureDeliveryStatus;
}

export interface UploadXmlResponse extends NFFutureDelivery {
  auto_linked_sales_order_id: string | null;
  created: boolean;
  source?: string;
}

export interface UploadInvoiceInput {
  file?: File | null;
  nfeKey?: string;
  lotNumber?: string;
  sapCode?: string;
  harvestYear?: string;
}

export interface UploadExcelRowError {
  row: number;
  nf_number: string;
  error: string;
}

export interface UploadExcelRowResult {
  row: number;
  nf_number: string;
  nf_id: string;
  mother_nf_id?: string;
  row_type?: 'child';
  status: 'created' | 'updated';
}

export interface UploadExcelResponse {
  dry_run: boolean;
  rows_total: number;
  rows_valid: number;
  rows_invalid: number;
  children_created: number;
  children_updated: number;
  errors: UploadExcelRowError[];
  results: UploadExcelRowResult[];
}

export const invoicesApi = {
  listFutureDelivery: async (params?: ListNFFutureDeliveryParams) => {
    const response = await apiClient.get<Paginated<NFFutureDelivery>>(
      '/invoices/future-delivery/',
      { params }
    );
    return response.data;
  },

  getFutureDelivery: async (id: string) => {
    const response = await apiClient.get<NFFutureDelivery>(
      `/invoices/future-delivery/${id}/`
    );
    return response.data;
  },

  uploadXml: async (file: File, lotNumber?: string) => {
    const form = new FormData();
    form.append('xml_file', file);
    if (lotNumber) form.append('lot_number', lotNumber);
    const response = await apiClient.post<UploadXmlResponse>(
      '/invoices/future-delivery/upload-xml/',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  /**
   * Flexible NF Entrega Futura upload. Accepts one of:
   *  - `file` with extension .xml (used directly), or
   *  - `file` with extension .pdf/.png/.jpg/.jpeg (OCR → chave → XML), or
   *  - `nfeKey` (44-digit key — XML fetched from SAP API).
   */
  uploadInvoice: async ({
    file,
    nfeKey,
    lotNumber,
    sapCode,
    harvestYear,
  }: UploadInvoiceInput) => {
    const form = new FormData();
    if (file) form.append('file', file);
    if (nfeKey) form.append('nfe_key', nfeKey.trim());
    if (lotNumber) form.append('lot_number', lotNumber);
    if (sapCode) form.append('sap_code', sapCode);
    if (harvestYear) form.append('harvest_year', harvestYear);
    const response = await apiClient.post<UploadXmlResponse>(
      '/invoices/future-delivery/upload-xml/',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  uploadExcel: async (file: File, dryRun = false) => {
    const form = new FormData();
    form.append('file', file);
    if (dryRun) form.append('dry_run', '1');
    const response = await apiClient.post<UploadExcelResponse>(
      '/invoices/future-delivery/upload-excel/',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  listChildren: async (params?: {
    mother_nf?: string;
    validation_status?: ChildNFValidationStatus;
    page?: number;
    page_size?: number;
    search?: string;
  }) => {
    const response = await apiClient.get<Paginated<ChildNF>>(
      '/invoices/child-nfs/',
      { params }
    );
    return response.data;
  },

  getMotherChildren: async (motherNfId: string) => {
    const response = await apiClient.get<{ count: number; results: ChildNF[] }>(
      `/invoices/future-delivery/${motherNfId}/children/`
    );
    return response.data;
  },

  listValidationErrors: async () => {
    const response = await apiClient.get<NFValidationErrorCatalog[]>(
      '/invoices/validation-errors/'
    );
    return response.data;
  },

  reprocessCorrection: async (childNfId: string, payload: { new_mother_ref: string; note?: string }) => {
    const response = await apiClient.post<{
      child: ChildNF;
      task_id: string;
      task_status: string;
    }>(`/invoices/child-nfs/${childNfId}/reprocess-correction/`, payload);
    return response.data;
  },
};
