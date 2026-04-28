'use client';

import { useRef, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ChevronDown, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { ordersApi } from '@/lib/api/orders';
import type {
  ListSalesOrdersParams,
  SalesOrder,
  SalesOrderStatus,
} from '@/lib/api/orders';
import { LogisticsSubNav } from '@/components/logistics/sub-nav';
import { BulkRFLModal } from '@/components/logistics/bulk-rfl-modal';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUrlPagination } from '@/lib/hooks/use-url-pagination';
import { notify } from '@/lib/notify';

const STATUS_VARIANT: Record<
  SalesOrderStatus,
  'default' | 'success' | 'warning' | 'info' | 'error'
> = {
  pending: 'warning',
  in_progress: 'info',
  closed: 'default',
  paused: 'error',
  invalidated: 'default',
};

function formatQty(value: string | null | undefined) {
  if (!value) return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatCurrency(value: string | null | undefined) {
  if (!value) return '-';
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '-';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

export default function OrdensVendaPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, setPageSize } = useUrlPagination();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [ovStatus, setOvStatus] = useState<SalesOrderStatus | ''>('');
  const [hasRfl, setHasRfl] = useState<'' | 'true' | 'false'>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [showPageSizeDropdown, setShowPageSizeDropdown] = useState(false);
  const pageSizeButtonRef = useRef<HTMLButtonElement>(null);
  const [pageSizeDropdownPosition, setPageSizeDropdownPosition] = useState({ left: 0, top: 0 });

  const PAGE_SIZE_OPTIONS = [20, 50, 100];

  function handleSearch() {
    setSearch(searchInput.trim());
    setPage(1);
  }

  function handleClearSearch() {
    setSearchInput('');
    setSearch('');
    setPage(1);
  }

  function togglePageSizeDropdown() {
    if (showPageSizeDropdown) {
      setShowPageSizeDropdown(false);
      return;
    }
    const rect = pageSizeButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const estimatedHeight = PAGE_SIZE_OPTIONS.length * 36;
      const opensUpward = rect.bottom + 4 + estimatedHeight > window.innerHeight;
      setPageSizeDropdownPosition({
        left: rect.right,
        top: opensUpward ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4,
      });
    }
    setShowPageSizeDropdown(true);
  }

  const params: ListSalesOrdersParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      ...(search ? { search } : {}),
      ...(ovStatus ? { ov_status: ovStatus } : {}),
      ...(hasRfl ? { has_rfl: hasRfl } : {}),
      ordering: '-created_at',
    }),
    [page, pageSize, search, ovStatus, hasRfl],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', params],
    queryFn: () => ordersApi.listSalesOrders(params),
  });

  const rows = data?.results ?? [];
  const total = data?.count ?? 0;

  const pageIds = rows.map((row) => row.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleBulkSuccess(updated: number) {
    notify.success(`${updated} ordem(ns) de venda atualizada(s).`);
    setModalOpen(false);
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Ordens de Venda
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Visualização completa das OVs para ajustes em massa.
        </p>
      </div>

      <LogisticsSubNav />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="min-w-60 flex-1">
          <label className="mb-1 block text-xs font-medium text-text-tertiary">
            Buscar (Nº OV, lote, produtor)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-8 text-sm focus:border-brand-blue focus:outline-none"
                placeholder="Digite para buscar…"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="flex items-center gap-1 rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-tertiary">
            Status OV
          </label>
          <select
            value={ovStatus}
            onChange={(e) => {
              setOvStatus(e.target.value as SalesOrderStatus | '');
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="pending">Aguardando criação</option>
            <option value="in_progress">Em andamento</option>
            <option value="closed">Encerrado</option>
            <option value="paused">Paralisado</option>
            <option value="invalidated">Invalidada</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-tertiary">
            RFL
          </label>
          <select
            value={hasRfl}
            onChange={(e) => {
              setHasRfl(e.target.value as '' | 'true' | 'false');
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="true">Preenchido</option>
            <option value="false">Vazio</option>
          </select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-md border border-brand-blue bg-blue-50 px-4 py-3">
          <span className="text-sm text-text-primary">
            <strong>{selectedIds.size}</strong> OV(s) selecionada(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-slate-50"
            >
              Limpar seleção
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Ajuste Valor RFL
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = somePageSelected;
                  }}
                  onChange={togglePage}
                  className="h-4 w-4"
                />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead>Nº OV</TableHead>
              <TableHead>Produtor</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Qtd total (kg)</TableHead>
              <TableHead className="text-right">Qtd saldo (kg)</TableHead>
              <TableHead className="text-right">RFL (R$/kg)</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row: SalesOrder) => {
              const selected = selectedIds.has(row.id);
              return (
                <TableRow
                  key={row.id}
                  className={selected ? 'bg-blue-50' : 'hover:bg-slate-50'}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleRow(row.id)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.ov_status]}>
                      {row.ov_status_display}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.cpf_cnpj || '-'}</TableCell>
                  <TableCell className="font-mono">
                    {row.ov_number || (
                      <span className="text-text-tertiary">pendente</span>
                    )}
                  </TableCell>
                  <TableCell>{row.producer_name || '-'}</TableCell>
                  <TableCell>{row.product || '-'}</TableCell>
                  <TableCell className="text-right">
                    {formatQty(row.total_quantity_kg)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatQty(row.balance_kg)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(row.rfl_value_kg)}
                  </TableCell>
                  <TableCell>{formatDate(row.created_at)}</TableCell>
                </TableRow>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell className="py-8 text-center text-sm text-text-tertiary">
                  Nenhuma ordem de venda encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {isLoading && (
          <div className="p-6 text-center text-sm text-text-tertiary">
            Carregando…
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
        <div className="text-xs font-medium text-text-tertiary">
          {total === 0
            ? '0 resultados'
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}
        </div>

        <div className="flex items-center gap-5">
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">Linhas por página:</span>
            <div className="relative">
              <button
                ref={pageSizeButtonRef}
                type="button"
                onClick={togglePageSizeDropdown}
                className="flex items-center gap-0.5 focus:outline-none"
              >
                <span className="text-xs font-medium text-text-tertiary">{pageSize}</span>
                <ChevronDown className="h-4 w-4 text-text-tertiary" />
              </button>
              {showPageSizeDropdown &&
                createPortal(
                  <>
                    <button
                      type="button"
                      aria-label="Fechar"
                      className="fixed inset-0 z-50 cursor-default"
                      onClick={() => setShowPageSizeDropdown(false)}
                    />
                    <div
                      style={{
                        position: 'fixed',
                        left: pageSizeDropdownPosition.left,
                        top: pageSizeDropdownPosition.top,
                        transform: 'translateX(-100%)',
                        zIndex: 9999,
                      }}
                      className="min-w-20 rounded-md border border-slate-200 bg-white shadow-lg"
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setPageSize(n);
                            setShowPageSizeDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-xs hover:bg-slate-50 ${n === pageSize ? 'bg-slate-50 font-semibold' : ''}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body,
                )}
            </div>
          </div>

          {/* Prev / page indicator / next */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center justify-center rounded-md px-1 py-0.5 shadow-[0px_0px_0px_1px_rgba(70,79,96,0.24)] bg-slate-100 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 text-text-tertiary" />
            </button>
            <span className="text-xs font-medium text-text-tertiary">
              {page}/{Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="flex items-center justify-center rounded-md px-1 py-0.5 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.10),0px_0px_0px_1px_rgba(70,79,96,0.16)] bg-white hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            </button>
          </div>
        </div>
      </div>
      </div>

      <BulkRFLModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedIds={Array.from(selectedIds)}
        onSuccess={handleBulkSuccess}
      />
    </div>
  );
}
