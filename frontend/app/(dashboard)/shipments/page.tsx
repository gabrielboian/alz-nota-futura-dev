'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Truck } from 'lucide-react';

import { contractsApi } from '@/lib/api/contracts';
import type { ContractManagedLot } from '@/lib/api/contracts';
import { DataTable } from '@/components/ui/data-table';
import type { Column, ColumnFilter } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { ShipmentWizard } from '@/components/shipments/shipment-wizard';
import { useUrlPagination } from '@/lib/hooks/use-url-pagination';

function formatDecimal(value: string | number | null | undefined, digits = 3) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function ShipmentsPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, setPageSize } = useUrlPagination();
  const [selectedLot, setSelectedLot] = useState<ContractManagedLot | null>(null);
  const [viewingLot, setViewingLot] = useState<ContractManagedLot | null>(null);
  const [filters, setFilters] = useState<ColumnFilter[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['shipment-awaiting-lots', page, pageSize, filters],
    queryFn: () => {
      const filterParams = filters.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {} as Record<string, string>);
      return contractsApi.listManagedLots({
        page,
        page_size: pageSize,
        status: 'awaiting_request',
        ...filterParams,
      });
    },
  });

  function openRequest(lot: ContractManagedLot) {
    setSelectedLot(lot);
  }

  function closeRequest() {
    setSelectedLot(null);
  }

  function handleWizardSuccess() {
    setSelectedLot(null);
    queryClient.invalidateQueries({ queryKey: ['shipment-awaiting-lots'] });
  }

  const columns: Column<ContractManagedLot>[] = [
    {
      key: 'lot_number',
      header: 'Nº Lote',
      width: '140px',
      filterable: true,
      filterType: 'text',
      render: (row) => row.base_lot_data?.lot_number ?? '-',
    },
    {
      key: 'producer_name',
      header: 'Produtor',
      filterable: true,
      filterType: 'text',
      render: (row) => row.base_lot_data?.producer_name ?? '-',
    },
    {
      key: 'product',
      header: 'Produto',
      width: '160px',
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: 'Soja', value: 'SOJA' },
        { label: 'Milho', value: 'MILHO' },
      ],
      render: (row) => row.base_lot_data?.product ?? '-',
    },
    {
      key: 'remaining',
      header: 'A entregar (KG)',
      width: '140px',
      render: (row) => formatDecimal(row.base_lot_data?.remaining_kg),
    },
    {
      key: 'harvest_year',
      header: 'Safra',
      width: '90px',
      filterable: true,
      filterType: 'text',
      render: (row) => row.harvest_year || '-',
    },
    {
      key: 'status',
      header: 'Status',
      width: '220px',
      render: (row) => <Badge variant="warning">{row.status_display}</Badge>,
    },
    {
      key: 'action',
      header: '',
      width: '300px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewingLot(row)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" />
            Detalhes
          </button>
          <button
            type="button"
            onClick={() => openRequest(row)}
            className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-blue/90"
          >
            <Truck className="h-3.5 w-3.5" />
            Solicitar embarque
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Solicitar embarque</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Lotes aguardando solicitação de embarque. Selecione um lote para abrir uma nova
          solicitação.
        </p>
      </div>

      <DataTable<ContractManagedLot>
        columns={columns}
        data={data?.results ?? []}
        totalItems={data?.count ?? 0}
        currentPage={page}
        filters={filters}
        onFilterChange={(f) => { setFilters(f); setPage(1); }}
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
        isOpen={viewingLot !== null}
        onClose={() => setViewingLot(null)}
        title="Detalhes do lote"
        closeOnEscape
      >
        {viewingLot && (
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">Status</span>
              <Badge variant="warning">{viewingLot.status_display}</Badge>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Contrato
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Nº Lote</div>
                  <div className="wrap-break-word font-semibold">{viewingLot.base_lot_data?.lot_number ?? '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Produtor</div>
                  <div className="wrap-break-word">{viewingLot.base_lot_data?.producer_name ?? '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">CPF/CNPJ</div>
                  <div className="wrap-break-word">{viewingLot.base_lot_data?.cpf_cnpj ?? '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Produto</div>
                  <div className="wrap-break-word">{viewingLot.base_lot_data?.product ?? '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Filial</div>
                  <div className="wrap-break-word">{viewingLot.base_lot_data?.branch_name ?? '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Cidade / UF</div>
                  <div className="wrap-break-word">
                    {[viewingLot.base_lot_data?.city, viewingLot.base_lot_data?.state_code]
                      .filter(Boolean)
                      .join(' / ') || '-'}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Safra</div>
                  <div className="wrap-break-word">{viewingLot.harvest_year || '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Tipo Frete</div>
                  <div className="wrap-break-word">{viewingLot.base_lot_data?.freight_type || '-'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Quantidades (KG)
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Quantidade</div>
                  <div className="wrap-break-word">{formatDecimal(viewingLot.base_lot_data?.quantity_kg)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Entregue</div>
                  <div className="wrap-break-word">{formatDecimal(viewingLot.base_lot_data?.delivered_kg)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">A entregar</div>
                  <div className="wrap-break-word font-semibold">{formatDecimal(viewingLot.base_lot_data?.remaining_kg)}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingLot(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  const lot = viewingLot;
                  setViewingLot(null);
                  if (lot) openRequest(lot);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90"
              >
                <Truck className="h-4 w-4" />
                Solicitar embarque
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ShipmentWizard
        lot={selectedLot}
        isOpen={selectedLot !== null}
        onClose={closeRequest}
        onSuccess={handleWizardSuccess}
      />
    </div>
  );
}
