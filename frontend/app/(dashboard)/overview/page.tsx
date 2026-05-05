'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Receipt,
  Truck,
  Workflow,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

import { dashboardApi, type DashboardKPIs } from '@/lib/api/dashboard';
import { Badge } from '@/components/ui/badge';

function formatKg(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' kg';
}

function formatInt(value: number) {
  return value.toLocaleString('pt-BR');
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
}

const OV_STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando criação',
  in_progress: 'Em andamento',
  closed: 'Encerrado',
  paused: 'Paralisado',
};

const OV_RPA_LABEL: Record<string, string> = {
  awaiting_ov_creation: 'Aguardando criação OV',
  executing: 'Executando',
  completed: 'Criado',
  error: 'Erro',
  na: 'Não se aplica',
  awaiting_ov_quantity_update: 'Aguardando atualização quantidade OV',
};

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  awaiting_request: 'Aguardando solicitação',
  awaiting_approval: 'Aguardando liberação',
  in_progress: 'Em andamento',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

const NF_STATUS_LABEL: Record<string, string> = {
  in_progress: 'Em andamento',
  finished: 'Finalizada',
};

const SHIP_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
};

export default function OverviewPage() {
  const { data, isLoading, refetch, isFetching, error } = useQuery<DashboardKPIs>({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardApi.getKPIs(),
    refetchInterval: 60_000,
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            Visão consolidada de contratos, OVs, NFs e embarques.
            {data?.generated_at && (
              <span className="ml-2 text-xs">
                (atualizado em {formatDate(data.generated_at)})
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-text-secondary hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
          />
          Atualizar
        </button>
      </div>

      {isLoading && (
        <div className="rounded-md bg-slate-50 p-6 text-sm text-text-tertiary">
          Carregando indicadores…
        </div>
      )}

      {error && !data && (
        <div className="rounded-md bg-error-light px-4 py-3 text-sm text-error">
          Não foi possível carregar os indicadores.
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Top row: headline KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={FileSpreadsheet}
              label="Contratos (lotes)"
              value={formatInt(data.contracts.total)}
              href="/contracts"
              subtitle={
                data.contracts.last_upload
                  ? `Último upload: ${formatDate(data.contracts.last_upload.upload_date)}`
                  : 'Sem uploads'
              }
            />
            <KpiCard
              icon={Workflow}
              label="OVs ativas"
              value={formatInt(data.sales_orders.total)}
              subtitle={`${formatInt(data.sales_orders.awaiting_sap)} aguardando SAP`}
              tone={data.sales_orders.rpa_errors > 0 ? 'warning' : 'default'}
              warning={
                data.sales_orders.rpa_errors > 0
                  ? `${data.sales_orders.rpa_errors} com erro de RPA`
                  : undefined
              }
            />
            <KpiCard
              icon={Receipt}
              label="NFs Entrega Futura"
              value={formatInt(data.nf_future_delivery.total)}
              href="/invoices/balances"
              subtitle={`Saldo a entregar: ${formatKg(data.nf_future_delivery.remaining_kg)}`}
            />
            <KpiCard
              icon={Truck}
              label="Embarques pendentes"
              value={formatInt(data.shipments.pending)}
              href="/shipments"
              subtitle={`${formatInt(data.shipments.approved_last_30d)} aprovados em 30 dias`}
            />
          </div>

          {/* Second row: status breakdowns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BreakdownCard
              title="Contratos por status"
              totalLabel="Total"
              total={data.contracts.total}
              data={data.contracts.by_status}
              labels={CONTRACT_STATUS_LABEL}
            />
            <BreakdownCard
              title="OVs por status RPA"
              totalLabel="Total"
              total={data.sales_orders.total}
              data={data.sales_orders.by_rpa_status}
              labels={OV_RPA_LABEL}
              highlightKey="error"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BreakdownCard
              title="OVs por status"
              totalLabel="Total"
              total={data.sales_orders.total}
              data={data.sales_orders.by_status}
              labels={OV_STATUS_LABEL}
            />
            <BreakdownCard
              title="Embarques por status"
              totalLabel="Total"
              total={data.shipments.total}
              data={data.shipments.by_status}
              labels={SHIP_STATUS_LABEL}
            />
          </div>

          {/* NF progress card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                NF Entrega Futura — Progresso
              </h2>
              <Link
                href="/invoices/balances"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue hover:underline"
              >
                Gestão de saldos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Total emitido" value={formatKg(data.nf_future_delivery.total_quantity_kg)} />
              <Stat label="Entregue" value={formatKg(data.nf_future_delivery.delivered_kg)} tone="success" />
              <Stat label="Saldo" value={formatKg(data.nf_future_delivery.remaining_kg)} tone="info" />
              <Stat
                label="NFs sem OV"
                value={formatInt(data.nf_future_delivery.in_progress_without_ov)}
                tone={data.nf_future_delivery.in_progress_without_ov > 0 ? 'warning' : 'default'}
              />
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-text-tertiary">
                <span>Progresso de entrega</span>
                <span>{data.nf_future_delivery.progress_pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-brand-blue transition-all"
                  style={{
                    width: `${Math.min(100, data.nf_future_delivery.progress_pct)}%`,
                  }}
                />
              </div>
            </div>

            <p className="mt-3 text-xs text-text-tertiary">
              Criadas nos últimos 7 dias:{' '}
              <strong>{formatInt(data.nf_future_delivery.created_last_7d)}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  href,
  tone = 'default',
  warning,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  href?: string;
  tone?: 'default' | 'warning';
  warning?: string;
}) {
  const content = (
    <div
      className={`rounded-lg border bg-white p-5 shadow-sm transition-all ${
        href ? 'hover:border-brand-blue hover:shadow-md' : ''
      } ${tone === 'warning' ? 'border-warning/50' : 'border-slate-200'}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
            {label}
          </p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
        </div>
      </div>
      {subtitle && (
        <p className="mt-3 text-xs text-text-tertiary">{subtitle}</p>
      )}
      {warning && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          {warning}
        </p>
      )}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function BreakdownCard({
  title,
  totalLabel,
  total,
  data,
  labels,
  highlightKey,
}: {
  title: string;
  totalLabel: string;
  total: number;
  data: Record<string, number>;
  labels: Record<string, string>;
  highlightKey?: string;
}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-secondary">{title}</h2>
        <span className="text-xs text-text-tertiary">
          {totalLabel}: <strong>{formatInt(total)}</strong>
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-text-tertiary">Sem registros.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([key, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isHighlight = key === highlightKey && count > 0;
            return (
              <li key={key} className="text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`${
                      isHighlight ? 'font-semibold text-warning' : 'text-text-secondary'
                    }`}
                  >
                    {labels[key] ?? key}
                  </span>
                  <span className="font-medium text-text-primary">
                    {formatInt(count)}{' '}
                    <span className="text-xs text-text-tertiary">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full ${
                      isHighlight ? 'bg-warning' : 'bg-brand-blue'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'info';
}) {
  const toneClass = {
    default: 'text-text-primary',
    success: 'text-success',
    warning: 'text-warning',
    info: 'text-brand-blue',
  }[tone];
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</dd>
    </div>
  );
}
