'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Download } from 'lucide-react';

import { contractsApi } from '@/lib/api/contracts';
import type { ContractManagedLot } from '@/lib/api/contracts';
import { DataTable } from '@/components/ui/data-table';
import type { Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { FileUpload } from '@/components/ui/file-upload';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Badge } from '@/components/ui/badge';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/errors';
import { useUrlPagination } from '@/lib/hooks/use-url-pagination';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default' | 'error'> = {
  awaiting_request: 'warning',
  awaiting_approval: 'warning',
  in_progress: 'info',
  finished: 'success',
  cancelled: 'error',
};

function formatDecimal(value: string | number | null | undefined, digits = 3) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function ContractsPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, setPageSize } = useUrlPagination();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contract-managed-lots', page, pageSize],
    queryFn: () => contractsApi.listManagedLots({ page, page_size: pageSize }),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => contractsApi.uploadFile(file),
    onSuccess: (result) => {
      setUploadError(null);
      setUploadOpen(false);
      const parts = [
        `${result.rows_created} criados`,
        `${result.rows_updated} atualizados`,
      ];
      if (result.rows_errored) parts.push(`${result.rows_errored} com erro`);
      notify.success(`Upload concluído: ${parts.join(', ')}.`);
      queryClient.invalidateQueries({ queryKey: ['contract-managed-lots'] });
    },
    onError: (err) => {
      // Keep retryable error inline in the modal, not as a toast.
      setUploadError(getErrorMessage(err, 'Não foi possível processar o arquivo.'));
    },
  });

  function openUpload() {
    setUploadError(null);
    uploadMutation.reset();
    setUploadOpen(true);
  }

  function closeUpload() {
    if (uploadMutation.isPending) return;
    setUploadOpen(false);
    setUploadError(null);
  }

  const columns: Column<ContractManagedLot>[] = [
    {
      key: 'lot_number',
      header: 'Nº Lote',
      width: '160px',
      render: (row) => row.base_lot_data?.lot_number ?? '-',
    },
    {
      key: 'producer_name',
      header: 'Produtor',
      render: (row) => row.base_lot_data?.producer_name ?? '-',
    },
    {
      key: 'product',
      header: 'Produto',
      width: '180px',
      render: (row) => row.base_lot_data?.product ?? '-',
    },
    {
      key: 'quantity',
      header: 'Quantidade (KG)',
      width: '140px',
      render: (row) => formatDecimal(row.base_lot_data?.quantity_kg),
    },
    {
      key: 'remaining',
      header: 'A entregar (KG)',
      width: '140px',
      render: (row) => formatDecimal(row.base_lot_data?.remaining_kg),
    },
    {
      key: 'freight_type',
      header: 'Frete',
      width: '80px',
      render: (row) => row.base_lot_data?.freight_type ?? '-',
    },
    {
      key: 'harvest_year',
      header: 'Safra',
      width: '90px',
      render: (row) => row.harvest_year || '-',
    },
    {
      key: 'status',
      header: 'Status',
      width: '200px',
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? 'default'}>{row.status_display}</Badge>
      ),
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Base de contratos</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            Lotes gerenciados oriundos do upload da planilha BD-Baixa-lote-compra.
          </p>
        </div>
        <ButtonPrimary icon={Upload} onClick={openUpload}>
          Upload da base
        </ButtonPrimary>
      </div>

      <DataTable<ContractManagedLot>
        columns={columns}
        data={data?.results ?? []}
        totalItems={data?.count ?? 0}
        currentPage={page}
        pagination={{
          enabled: true,
          pageSize,
          onPageChange: (p) => setPage(p),
          onPageSizeChange: (s) => setPageSize(s),
        }}
      />
      {isLoading && (
        <div className="p-4 text-center text-sm text-text-tertiary">Carregando…</div>
      )}

      <Modal
        isOpen={uploadOpen}
        onClose={closeUpload}
        title="Upload da base de contratos"
        closeOnEscape
      >
        <div className="p-6">
          <p className="mb-4 text-sm text-text-secondary">
            Envie o arquivo <strong>Rascunho Banco de Dados - NF Entrega Futura.xlsx</strong>{' '}
            (aba <code>BD-Baixa-lote-compra</code>). O sistema irá criar um registro para cada
            lote e iniciar o acompanhamento.
          </p>

          <a
            href="/exemplo-contratos.xlsx"
            download
            className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 transition-colors hover:bg-brand-blue/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-blue text-white">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">
                  Baixar planilha de exemplo
                </div>
                <div className="text-xs text-text-tertiary">
                  Veja o formato esperado antes de enviar
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-brand-blue">.xlsx</span>
          </a>

          {uploadError && (
            <div
              role="alert"
              className="mb-4 rounded-md bg-error-light px-3 py-2 text-sm text-error"
            >
              {uploadError}
            </div>
          )}

          <FileUpload
            accept=".xlsx,.xls"
            multiple={false}
            label="Arraste o arquivo .xlsx ou clique para selecionar"
            disabled={uploadMutation.isPending}
            onFilesSelected={(files) => {
              if (files[0]) {
                setUploadError(null);
                uploadMutation.mutate(files[0]);
              }
            }}
          />
          {uploadMutation.isPending && (
            <p className="mt-4 text-sm text-text-tertiary">Processando arquivo…</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
