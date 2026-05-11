'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Search,
  XCircle,
  Zap,
} from 'lucide-react';

import { ordersApi } from '@/lib/api/orders';
import type { SalesOrder } from '@/lib/api/orders';
import { Badge } from '@/components/ui/badge';
import { ReprocessOvModal } from '@/components/shipments/reprocess-ov-modal';
import { OvCommentsModal } from '@/components/shipments/ov-comments-modal';
import { useUrlPagination } from '@/lib/hooks/use-url-pagination';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatKg(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon,
  iconCls,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconCls: string;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconCls}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        {loading ? (
          <div className="mt-1 h-7 w-10 animate-pulse rounded bg-slate-200" />
        ) : (
          <p className="text-2xl font-semibold text-slate-900">{value}</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReprocessPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, setPageSize } = useUrlPagination();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'business_exception' | 'system_exception' | ''>('');
  const [reprocessOv, setReprocessOv] = useState<SalesOrder | null>(null);
  const [commentsOv, setCommentsOv] = useState<SalesOrder | null>(null);

  const hasActiveFilters = !!(search.trim() || typeFilter);

  function clearFilters() {
    setSearch('');
    setTypeFilter('');
    setPage(1);
  }

  const params = useMemo(
    () => ({
      page,
      page_size: pageSize,
      rpa_status: 'error' as const,
      ...(typeFilter ? { rpa_error_type: typeFilter } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [page, pageSize, typeFilter, search],
  );

  // Stat queries — unfiltered totals
  const businessQuery = useQuery({
    queryKey: ['exception-ovs-count', 'business_exception'],
    queryFn: () => ordersApi.listSalesOrders({ rpa_status: 'error', rpa_error_type: 'business_exception', page_size: 1 }),
    refetchInterval: 30_000,
  });
  const systemQuery = useQuery({
    queryKey: ['exception-ovs-count', 'system_exception'],
    queryFn: () => ordersApi.listSalesOrders({ rpa_status: 'error', rpa_error_type: 'system_exception', page_size: 1 }),
    refetchInterval: 30_000,
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['exception-ovs', params],
    queryFn: () => ordersApi.listSalesOrders(params),
    refetchInterval: 30_000,
  });

  const ovs = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const businessTotal = businessQuery.data?.count ?? 0;
  const systemTotal = systemQuery.data?.count ?? 0;
  const statsLoading = businessQuery.isLoading || systemQuery.isLoading;

  return (
    <div className="flex flex-col gap-6 px-6 py-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reprocessamento de OVs</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Ordens de venda com exceção de negócio ou sistema aguardando reprocessamento via RPA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Exceção de Negócio"
          value={businessTotal}
          loading={statsLoading}
          icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
          iconCls="bg-orange-50"
        />
        <StatCard
          title="Exceção de Sistema"
          value={systemTotal}
          loading={statsLoading}
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          iconCls="bg-red-50"
        />
        <StatCard
          title="Total com exceção"
          value={businessTotal + systemTotal}
          loading={statsLoading}
          icon={<CheckCircle2 className="h-5 w-5 text-slate-400" />}
          iconCls="bg-slate-50"
        />
      </div>

      {/* Filter Panel */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Search className="h-4 w-4" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              <XCircle className="h-4 w-4" />
              Limpar filtros
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="OV, produtor, lote…"
                className="h-9 w-56 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-slate-900 focus:outline-2 focus:outline-cyan-900"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Tipo de exceção</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as typeof typeFilter); setPage(1); }}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-slate-900 focus:outline-2 focus:outline-cyan-900"
            >
              <option value="">Todos</option>
              <option value="business_exception">Exceção de negócio</option>
              <option value="system_exception">Exceção de sistema</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-text-tertiary">Carregando…</div>
      ) : ovs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-text-tertiary">
          Nenhuma OV com exceção encontrada.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {ovs.map((ov) => (
              <ExceptionOvCard
                key={ov.id}
                ov={ov}
                onReprocess={() => setReprocessOv(ov)}
                onComments={() => setCommentsOv(ov)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-text-tertiary">
              <span>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span>{page} / {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
                >
                  Próxima
                </button>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                >
                  {[20, 50, 100].map((s) => (
                    <option key={s} value={s}>{s} / pág</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </>
      )}

      <ReprocessOvModal
        ov={reprocessOv}
        isOpen={reprocessOv !== null}
        onClose={() => setReprocessOv(null)}
        onSuccess={() => {
          setReprocessOv(null);
          queryClient.invalidateQueries({ queryKey: ['exception-ovs'] });
          queryClient.invalidateQueries({ queryKey: ['exception-ovs-count'] });
        }}
      />
      <OvCommentsModal
        ov={commentsOv}
        isOpen={commentsOv !== null}
        onClose={() => setCommentsOv(null)}
      />
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ExceptionOvCard({
  ov,
  onReprocess,
  onComments,
}: {
  ov: SalesOrder;
  onReprocess: () => void;
  onComments: () => void;
}) {
  const isBusinessException = ov.rpa_error_type === 'business_exception';

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {isBusinessException ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />
          ) : (
            <Zap className="h-4 w-4 shrink-0 text-red-500" />
          )}
          <span className="font-semibold text-slate-900">
            OV: {ov.ov_number || '— pendente —'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isBusinessException
                ? 'bg-orange-100 text-orange-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {isBusinessException ? 'Exceção de Negócio' : 'Exceção de Sistema'}
          </span>
          {ov.lot_number && (
            <Link
              href={`/logistics/shipments/${ov.managed_lot}`}
              className="text-xs text-brand-blue hover:underline"
              title="Ver lote"
            >
              Lote {ov.lot_number}
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* Error message */}
        {ov.rpa_error_message && (
          <div
            className={`rounded-lg border p-3 ${
              isBusinessException
                ? 'border-orange-200 bg-orange-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <p
              className={`truncate font-mono text-xs ${
                isBusinessException ? 'text-orange-700' : 'text-red-700'
              }`}
              title={ov.rpa_error_message}
            >
              {ov.rpa_error_message}
            </p>
          </div>
        )}

        {/* Route */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex-1">
            <div className="text-xs text-slate-400">TRANSBORDO</div>
            <div className="font-medium text-slate-900">
              {ov.transshipment_location_name || '—'}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
          <div className="flex-1 text-right">
            <div className="text-xs text-slate-400">DESTINO FINAL</div>
            <div className="font-medium text-slate-900">
              {ov.terminal_destination_name || '—'}
            </div>
          </div>
        </div>

        {/* Producer + branch */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-700">{ov.billing_producer_name || '-'}</span>
          <span className="text-xs text-slate-400">{ov.billing_branch_name || '—'}</span>
        </div>

        {/* Quantities */}
        <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-sm">
          <div>
            <div className="text-xs text-slate-400">Qtd OV</div>
            <div className="font-medium text-slate-900">{formatKg(ov.total_quantity_kg)} kg</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Entregue</div>
            <div className="font-medium text-slate-900">{formatKg(ov.delivered_quantity_kg)} kg</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Tentativas RPA</div>
            <div className="font-medium text-slate-900">{ov.rpa_retry_count}</div>
          </div>
        </div>

        {ov.rpa_last_attempt_at && (
          <div className="text-xs text-slate-400">
            Última tentativa: {formatDateTime(ov.rpa_last_attempt_at)}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={onComments}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Comentários
          </button>
          <button
            type="button"
            onClick={onReprocess}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-blue bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reprocessar
          </button>
        </div>
      </div>
    </div>
  );
}
