'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { invoicesApi, type NFFutureDelivery, type NFFutureDeliveryStatus } from '@/lib/api/invoices';
import type { ContractBaseLot } from '@/lib/api/contracts';
import { DataTable, type Column, type ColumnFilter } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { FileUpload } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { ContractLotPicker } from '@/components/ui/contract-lot-picker';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/errors';
import { useUrlPagination } from '@/lib/hooks/use-url-pagination';
import { ChildrenDetailModal } from '@/components/invoices/children-detail-modal';

function formatDecimal(value: string | number | null | undefined, digits = 3) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCurrency(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function NFBalancesPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, setPageSize } = useUrlPagination();
  const [status, setStatus] = useState<NFFutureDeliveryStatus>('in_progress');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<ContractBaseLot | null>(null);
  const [sapCode, setSapCode] = useState('');
  const [harvestYear, setHarvestYear] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    contract?: string;
    sap?: string;
    harvest?: string;
  }>({});
  const [childrenModalState, setChildrenModalState] = useState<{
    motherNfId: string | null;
    motherNfNumber: string;
  }>({ motherNfId: null, motherNfNumber: '' });
  const [tableFilters, setTableFilters] = useState<ColumnFilter[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['nf-future-delivery', status, page, pageSize, tableFilters],
    queryFn: () => {
      const filterParams = tableFilters.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {} as Record<string, string>);
      return invoicesApi.listFutureDelivery({ status, page, page_size: pageSize, ...filterParams });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      invoicesApi.uploadInvoice({
        file,
        lotNumber: selectedContract?.lot_number,
        sapCode: sapCode.trim() || undefined,
        harvestYear: harvestYear.trim() || undefined,
      }),
    onSuccess: (result) => {
      setUploadError(null);
      setUploadOpen(false);
      setSelectedContract(null);
      setSapCode('');
      setHarvestYear('');
      setFieldErrors({});
      const linkedMsg = result.auto_linked_sales_order_id
        ? ` OV vinculada automaticamente.`
        : '';
      notify.success(
        `${result.created ? 'NF EF criada' : 'NF EF atualizada'}.${linkedMsg}`,
      );
      queryClient.invalidateQueries({ queryKey: ['nf-future-delivery'] });
    },
    onError: (err) => {
      setUploadError(getErrorMessage(err, 'Não foi possível processar a NF.'));
    },
  });

  function openUpload() {
    setUploadError(null);
    setSelectedContract(null);
    setSapCode('');
    setHarvestYear('');
    setFieldErrors({});
    uploadMutation.reset();
    setUploadOpen(true);
  }

  function closeUpload() {
    if (uploadMutation.isPending) return;
    setUploadOpen(false);
    setUploadError(null);
  }

  const columns: Column<NFFutureDelivery>[] = [
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (r) => (
        <Badge variant={r.status === 'finished' ? 'success' : 'info'}>{r.status_display}</Badge>
      ),
    },
    { key: 'nf_number', header: 'Nº NF', width: '110px', filterable: true, filterType: 'text', render: (r) => r.nf_number || '-' },
    { key: 'quantity_kg', header: 'Qtd NF (kg)', width: '130px', render: (r) => formatDecimal(r.quantity_kg) },
    { key: 'unit_value', header: 'Vlr Unitário', width: '130px', render: (r) => formatCurrency(r.unit_value) },
    { key: 'gross_value', header: 'Vlr Bruto', width: '150px', render: (r) => formatCurrency(r.gross_value) },
    { key: 'branch_name', header: 'Filial', render: (r) => r.branch_name || '-' },
    { key: 'product', header: 'Produto', width: '140px', filterable: true, filterType: 'select', filterOptions: [{ label: 'Soja', value: 'SOJA' }, { label: 'Milho', value: 'MILHO' }], render: (r) => r.product || '-' },
    { key: 'harvest_year', header: 'Safra', width: '90px', filterable: true, filterType: 'text', render: (r) => r.harvest_year || '-' },
    { key: 'issue_date', header: 'Emissão', width: '110px', render: (r) => formatDate(r.issue_date) },
    { key: 'sap_code', header: 'Cód SAP', width: '110px', render: (r) => r.sap_code || '-' },
    { key: 'state_registration', header: 'Nº IE', width: '130px', render: (r) => r.state_registration || '-' },
    { key: 'lot_number', header: 'Nº Lote', width: '130px', filterable: true, filterType: 'text', render: (r) => r.lot_number || '-' },
    { key: 'producer_name', header: 'Produtor', filterable: true, filterType: 'text', render: (r) => r.producer_name || '-' },
    { key: 'delivered_quantity_kg', header: 'Qtd Entregue', width: '140px', render: (r) => formatDecimal(r.delivered_quantity_kg) },
    { key: 'remaining_quantity_kg', header: 'Saldo a entregar', width: '150px', render: (r) => formatDecimal(r.remaining_quantity_kg) },
    {
      key: 'children_summary',
      header: 'Filhas (validação)',
      width: '160px',
      render: (r) => {
        const s = r.children_summary ?? { total: 0, valid: 0, invalid: 0, pending: 0, needs_review: 0 };
        if (s.total === 0) return <span className="text-text-tertiary">—</span>;
        let variant: 'success' | 'error' | 'warning' | 'info' = 'info';
        let label = `${s.total} filha${s.total > 1 ? 's' : ''}`;
        if (s.invalid > 0) {
          variant = 'error';
          label = `${s.invalid}/${s.total} inválida${s.invalid > 1 ? 's' : ''}`;
        } else if (s.needs_review > 0) {
          variant = 'warning';
          label = `${s.needs_review}/${s.total} revisar`;
        } else if (s.pending > 0) {
          variant = 'info';
          label = `${s.pending}/${s.total} pendente${s.pending > 1 ? 's' : ''}`;
        } else if (s.valid === s.total) {
          variant = 'success';
          label = `${s.total} válida${s.total > 1 ? 's' : ''}`;
        }
        return (
          <button
            type="button"
            onClick={() =>
              setChildrenModalState({ motherNfId: r.id, motherNfNumber: r.nf_number })
            }
            className="cursor-pointer"
            title="Ver detalhes das NFs filhas"
          >
            <Badge variant={variant}>{label}</Badge>
          </button>
        );
      },
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">NF Entrega Futura — Gestão de saldos</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            Acompanhe os saldos das notas fiscais de entrega futura.
          </p>
        </div>
        <ButtonPrimary icon={Plus} onClick={openUpload}>
          Input NF EF
        </ButtonPrimary>
      </div>

      <div className="mb-4">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as NFFutureDeliveryStatus);
            setPage(1);
          }}
          tabs={[
            { value: 'in_progress', label: 'Andamento' },
            { value: 'finished', label: 'Finalizados' },
          ]}
        />
      </div>

      <DataTable<NFFutureDelivery>
        columns={columns}
        data={data?.results ?? []}
        totalItems={data?.count ?? 0}
        currentPage={page}
        filters={tableFilters}
        onFilterChange={(f) => { setTableFilters(f); setPage(1); }}
        pagination={{
          enabled: true,
          pageSize,
          onPageChange: (p) => setPage(p),
          onPageSizeChange: (s) => setPageSize(s),
        }}
      />
      {isLoading && <div className="p-4 text-center text-sm text-text-tertiary">Carregando…</div>}

      <Modal isOpen={uploadOpen} onClose={closeUpload} title="Input NF Entrega Futura" closeOnEscape>
        <div className="p-6 space-y-4">
          <p className="text-sm text-text-secondary">
            Envie a NF mãe em XML, PDF, PNG, JPG ou JPEG. Arquivos XML são lidos diretamente;
            PDFs e imagens passam pelo OCR para extrair a chave. Do XML extraímos{' '}
            <strong>Cliente, Nº NF, Qtd NF, Vlr Unitário, Vlr Total, Produto, Data Emissão
            e IE</strong>. Os demais campos (<strong>Cód SAP, Nº Contrato, Safra</strong>)
            devem ser preenchidos abaixo.
          </p>

          {uploadError && (
            <div role="alert" className="rounded-md bg-error-light px-3 py-2 text-sm text-error">
              {uploadError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cód SAP"
              value={sapCode}
              onChange={(e) => setSapCode(e.target.value)}
              placeholder="Ex.: 7000123456"
              error={fieldErrors.sap}
              disabled={uploadMutation.isPending}
            />
            <Input
              label="Safra"
              value={harvestYear}
              onChange={(e) => setHarvestYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Ex.: 2425"
              maxLength={4}
              error={fieldErrors.harvest}
              disabled={uploadMutation.isPending}
            />
          </div>

          <ContractLotPicker
            value={selectedContract}
            onChange={setSelectedContract}
            error={fieldErrors.contract}
            disabled={uploadMutation.isPending}
          />

          <FileUpload
            accept=".xml,.pdf,.png,.jpg,.jpeg"
            multiple={false}
            label="Arraste a NF (XML, PDF, PNG, JPG ou JPEG) ou clique para selecionar"
            disabled={uploadMutation.isPending}
            onFilesSelected={(files) => {
              const file = files[0];
              if (!file) return;
              const nextErrors: typeof fieldErrors = {};
              if (!selectedContract) nextErrors.contract = 'Selecione o contrato.';
              if (!sapCode.trim()) nextErrors.sap = 'Informe o Cód SAP.';
              if (!harvestYear.trim() || harvestYear.trim().length !== 4) {
                nextErrors.harvest = 'Informe a safra (4 dígitos).';
              }
              setFieldErrors(nextErrors);
              if (Object.keys(nextErrors).length > 0) {
                setUploadError(
                  'Preencha Cód SAP, Safra e Nº do Contrato antes de enviar a NF.',
                );
                return;
              }
              setUploadError(null);
              uploadMutation.mutate(file);
            }}
          />

          {uploadMutation.isPending && (
            <p className="text-sm text-text-tertiary">Processando NF…</p>
          )}
        </div>
      </Modal>

      <ChildrenDetailModal
        isOpen={!!childrenModalState.motherNfId}
        onClose={() => setChildrenModalState({ motherNfId: null, motherNfNumber: '' })}
        motherNfId={childrenModalState.motherNfId}
        motherNfNumber={childrenModalState.motherNfNumber}
      />
    </div>
  );
}
