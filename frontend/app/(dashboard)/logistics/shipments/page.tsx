'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, ExternalLink, X } from 'lucide-react';

import { shipmentsApi } from '@/lib/api/shipments';
import type { ShipmentRequest, ShipmentStatus } from '@/lib/api/shipments';
import { contractsApi } from '@/lib/api/contracts';
import type { ContractManagedLot } from '@/lib/api/contracts';
import { DataTable } from '@/components/ui/data-table';
import type { Column, ColumnFilter } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Tabs } from '@/components/ui/tabs';
import { ShipmentWizard } from '@/components/shipments/shipment-wizard';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/errors';
import { useUrlPagination } from '@/lib/hooks/use-url-pagination';
import { LogisticsSubNav } from '@/components/logistics/sub-nav';

type TabKey = 'pending' | 'in_progress' | 'finished' | 'cancelled';

const TABS: { label: string; value: TabKey }[] = [
  { label: 'Solicitações', value: 'pending' },
  { label: 'Andamento', value: 'in_progress' },
  { label: 'Finalizados', value: 'finished' },
  { label: 'Cancelados', value: 'cancelled' },
];

function formatKg(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

const STATUS_VARIANT: Record<ShipmentStatus, 'success' | 'warning' | 'info' | 'default' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'default',
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

export default function LogisticsShipmentsPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, setPageSize } = useUrlPagination();
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [rejecting, setRejecting] = useState<ShipmentRequest | null>(null);
  const [viewing, setViewing] = useState<ShipmentRequest | null>(null);
  const [approving, setApproving] = useState<ShipmentRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [requestFilters, setRequestFilters] = useState<ColumnFilter[]>([]);
  const [lotFilters, setLotFilters] = useState<ColumnFilter[]>([]);

  const isRequestTab = activeTab === 'pending';

  const requestsQuery = useQuery({
    queryKey: ['shipment-requests', page, pageSize, 'pending', requestFilters],
    queryFn: () => {
      const filterParams = requestFilters.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {} as Record<string, string>);
      return shipmentsApi.list({
        page,
        page_size: pageSize,
        status: 'pending' as ShipmentStatus,
        ...filterParams,
      });
    },
    enabled: isRequestTab,
  });

  const lotsQuery = useQuery({
    queryKey: ['managed-lots', 'logistics', page, pageSize, activeTab, lotFilters],
    queryFn: () => {
      const filterParams = lotFilters.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {} as Record<string, string>);
      return contractsApi.listManagedLots({
        page,
        page_size: pageSize,
        status: activeTab,
        ordering: '-updated_at',
        ...filterParams,
      });
    },
    enabled: !isRequestTab,
  });

  const isLoading = isRequestTab ? requestsQuery.isLoading : lotsQuery.isLoading;
  const totalItems = isRequestTab
    ? (requestsQuery.data?.count ?? 0)
    : (lotsQuery.data?.count ?? 0);

  const approvingLotQuery = useQuery({
    queryKey: ['managed-lot', approving?.managed_lot],
    queryFn: () => contractsApi.getManagedLot(approving!.managed_lot),
    enabled: approving !== null,
  });

  const rejectMutation = useMutation({
    mutationFn: (payload: { id: string; notes: string }) =>
      shipmentsApi.reject(payload.id, payload.notes),
    onSuccess: () => {
      setRejecting(null);
      setRejectNotes('');
      setActionError(null);
      notify.success('Solicitação rejeitada.');
      queryClient.invalidateQueries({ queryKey: ['shipment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['managed-lots'] });
    },
    onError: (err) => {
      setActionError(getErrorMessage(err, 'Não foi possível rejeitar a solicitação.'));
    },
  });

  function openReject(req: ShipmentRequest) {
    setActionError(null);
    rejectMutation.reset();
    setRejectNotes(req.notes || '');
    setRejecting(req);
  }

  function closeReject() {
    if (rejectMutation.isPending) return;
    setRejecting(null);
    setRejectNotes('');
    setActionError(null);
  }

  function submitReject() {
    if (!rejecting) return;
    rejectMutation.mutate({ id: rejecting.id, notes: rejectNotes });
  }

  function handleTabChange(value: string) {
    setActiveTab(value as TabKey);
    setPage(1);
    setRequestFilters([]);
    setLotFilters([]);
  }

  const columns: Column<ShipmentRequest>[] = useMemo(() => {
    const base: Column<ShipmentRequest>[] = [
      {
        key: 'lot_number',
        header: 'Nº Lote',
        width: '140px',
        filterable: true,
        filterType: 'text',
        render: (row) => row.lot_number || '-',
      },
      {
        key: 'producer_name',
        header: 'Produtor',
        filterable: true,
        filterType: 'text',
        render: (row) => row.producer_name || '-',
      },
      {
        key: 'requested_by',
        header: 'Solicitado por',
        render: (row) => row.requested_by_email || '-',
      },
      {
        key: 'requested_at',
        header: 'Solicitado em',
        width: '170px',
        render: (row) => formatDateTime(row.requested_at),
      },
      {
        key: 'status',
        header: 'Status',
        width: '140px',
        render: (row) => (
          <Badge variant={STATUS_VARIANT[row.status]}>{row.status_display}</Badge>
        ),
      },
    ];

    base.push({
      key: 'actions',
      header: '',
      width: '340px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewing(row)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" />
            Detalhes
          </button>
          <button
            type="button"
            onClick={() => setApproving(row)}
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Aprovar
          </button>
          <button
            type="button"
            onClick={() => openReject(row)}
            className="inline-flex items-center gap-1 rounded-md border border-red-500 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </button>
        </div>
      ),
    });

    return base;
  }, []);

  const lotColumns: Column<ContractManagedLot>[] = useMemo(
    () => [
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
        width: '140px',
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { label: 'Soja', value: 'SOJA' },
          { label: 'Milho', value: 'MILHO' },
        ],
        render: (row) => row.base_lot_data?.product ?? '-',
      },
      {
        key: 'quantity',
        header: 'Qtd (kg)',
        width: '120px',
        render: (row) => formatKg(row.base_lot_data?.quantity_kg),
      },
      {
        key: 'remaining',
        header: 'Saldo (kg)',
        width: '120px',
        render: (row) => formatKg(row.base_lot_data?.remaining_kg),
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
        width: '200px',
        render: (row) => (
          <Badge
            variant={
              row.status === 'finished'
                ? 'success'
                : row.status === 'cancelled'
                  ? 'default'
                  : 'info'
            }
          >
            {row.status_display}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        width: '140px',
        render: (row) => (
          <Link
            href={`/logistics/shipments/${row.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-brand-blue bg-white px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver lote
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Gestão de embarques</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Solicitações de embarque, embarques em andamento, finalizados e cancelados.
        </p>
      </div>

      <LogisticsSubNav />

      <Tabs
        tabs={TABS.map((t) => ({ label: t.label, value: t.value }))}
        value={activeTab}
        onValueChange={handleTabChange}
        headerOnly
        className="mb-6"
      />

      {isRequestTab ? (
        <DataTable<ShipmentRequest>
          columns={columns}
          data={requestsQuery.data?.results ?? []}
          totalItems={totalItems}
          currentPage={page}
          filters={requestFilters}
          onFilterChange={(f) => { setRequestFilters(f); setPage(1); }}
          pagination={{
            enabled: true,
            pageSize,
            onPageChange: (p) => setPage(p),
            onPageSizeChange: (s) => setPageSize(s),
          }}
        />
      ) : (
        <DataTable<ContractManagedLot>
          columns={lotColumns}
          data={lotsQuery.data?.results ?? []}
          totalItems={totalItems}
          currentPage={page}
          filters={lotFilters}
          onFilterChange={(f) => { setLotFilters(f); setPage(1); }}
          pagination={{
            enabled: true,
            pageSize,
            onPageChange: (p) => setPage(p),
            onPageSizeChange: (s) => setPageSize(s),
          }}
        />
      )}
      {isLoading && (
        <div className="p-4 text-center text-sm text-text-tertiary">Carregando…</div>
      )}

      <Modal
        isOpen={viewing !== null}
        onClose={() => setViewing(null)}
        title="Detalhes da solicitação"
        closeOnEscape
      >
        {viewing && (
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">Status</span>
              <Badge variant={STATUS_VARIANT[viewing.status]}>{viewing.status_display}</Badge>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Lote
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Nº Lote</div>
                  <div className="wrap-break-word font-semibold">{viewing.lot_number || '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Produtor</div>
                  <div className="wrap-break-word">{viewing.producer_name || '-'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Solicitação
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Solicitado por</div>
                  <div className="wrap-break-word">{viewing.requested_by_email || '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Solicitado em</div>
                  <div className="wrap-break-word">{formatDateTime(viewing.requested_at)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Aprovado por</div>
                  <div className="wrap-break-word">{viewing.approved_by_email || '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-text-tertiary">Aprovado em</div>
                  <div className="wrap-break-word">{formatDateTime(viewing.approved_at)}</div>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <div className="text-xs text-text-tertiary">Ticket Desk Manager</div>
                  <div className="wrap-break-word">{viewing.desk_manager_ticket_id || '-'}</div>
                </div>
              </div>
            </div>

            {viewing.notes && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Observações
                </div>
                <p className="whitespace-pre-wrap text-text-primary">{viewing.notes}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={rejecting !== null}
        onClose={closeReject}
        title="Rejeitar solicitação"
        closeOnEscape
      >
        <div className="p-6">
          {rejecting && (
            <p className="mb-4 text-sm text-text-secondary">
              Lote <strong>{rejecting.lot_number}</strong> — {rejecting.producer_name}
            </p>
          )}

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-text-primary">
              Motivo da rejeição
            </span>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              placeholder="Informe o motivo para a rejeição…"
              disabled={rejectMutation.isPending}
            />
          </label>

          {actionError && (
            <div
              role="alert"
              className="mb-4 rounded-md bg-error-light px-3 py-2 text-sm text-error"
            >
              {actionError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeReject}
              disabled={rejectMutation.isPending}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitReject}
              disabled={rejectMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Enviando…' : 'Rejeitar'}
            </button>
          </div>
        </div>
      </Modal>

      <ShipmentWizard
        mode="approve"
        lot={approvingLotQuery.data ?? null}
        shipmentRequestId={approving?.id}
        isOpen={approving !== null && approvingLotQuery.data !== undefined}
        onClose={() => setApproving(null)}
        onSuccess={() => {
          setApproving(null);
          queryClient.invalidateQueries({ queryKey: ['shipment-requests'] });
          queryClient.invalidateQueries({ queryKey: ['managed-lots'] });
        }}
      />
    </div>
  );
}
