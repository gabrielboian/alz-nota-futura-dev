'use client';

import { useMemo, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';

import { contractsApi } from '@/lib/api/contracts';
import { ordersApi } from '@/lib/api/orders';
import { invoicesApi } from '@/lib/api/invoices';
import { rpaTasksApi } from '@/lib/api/rpa-tasks';
import type { SalesOrder, LoadingOrder } from '@/lib/api/orders';
import type { NFFutureDelivery } from '@/lib/api/invoices';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlterOvModal } from '@/components/shipments/alter-ov-modal';
import { IncreaseBalanceModal } from '@/components/shipments/increase-balance-modal';
import { RegisterManualOVModal } from '@/components/shipments/register-manual-ov-modal';
import { ReprocessOvModal } from '@/components/shipments/reprocess-ov-modal';
import { OvCommentsModal } from '@/components/shipments/ov-comments-modal';

type PageParams = { lotId: string };

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function formatKg(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
        {label}
      </div>
      <div className="mt-1 text-sm text-text-primary">{value || '-'}</div>
    </div>
  );
}

const OV_STATUS_VARIANT: Record<SalesOrder['ov_status'], 'info' | 'success' | 'warning' | 'default'> = {
  pending: 'warning',
  in_progress: 'info',
  closed: 'success',
  paused: 'default',
  invalidated: 'default',
};

export default function LoteDetailPage({ params }: { params: Promise<PageParams> }) {
  const { lotId } = use(params);
  const [search, setSearch] = useState('');
  const [alterOv, setAlterOv] = useState<SalesOrder | null>(null);
  const [increaseOv, setIncreaseOv] = useState<SalesOrder | null>(null);
  const [registerManualOpen, setRegisterManualOpen] = useState(false);
  const [reprocessOv, setReprocessOv] = useState<SalesOrder | null>(null);
  const [commentsOv, setCommentsOv] = useState<SalesOrder | null>(null);

  const lotQuery = useQuery({
    queryKey: ['managed-lot', lotId],
    queryFn: () => contractsApi.getManagedLot(lotId),
  });

  const ovsQuery = useQuery({
    queryKey: ['sales-orders', lotId],
    queryFn: () => ordersApi.listSalesOrders({ managed_lot: lotId, page_size: 100 }),
  });

  const lot = lotQuery.data;
  const baseLot = lot?.base_lot_data;
  const lotNumber = baseLot?.lot_number ?? '';

  const nfQuery = useQuery({
    queryKey: ['nf-future', lotNumber],
    queryFn: () => invoicesApi.listFutureDelivery({ lot_number: lotNumber, page_size: 10 }),
    enabled: !!lotNumber,
  });

  const ovs = ovsQuery.data?.results ?? [];
  const nfs = nfQuery.data?.results ?? [];
  const hasNFFutureDelivery = nfs.length > 0;
  const firstNF = nfs[0];

  const filteredOvs = useMemo(() => {
    if (!search.trim()) return ovs;
    const q = search.trim().toLowerCase();
    return ovs.filter(
      (o) =>
        o.ov_number.toLowerCase().includes(q) ||
        o.billing_producer_name.toLowerCase().includes(q) ||
        (o.transshipment_location_name ?? '').toLowerCase().includes(q) ||
        (o.terminal_destination_name ?? '').toLowerCase().includes(q)
    );
  }, [ovs, search]);

  const totalDelivered = ovs.reduce(
    (acc, o) => acc + Number(o.delivered_quantity_kg || 0),
    0
  );
  const totalLot = Number(baseLot?.quantity_kg ?? 0);
  const remaining = totalLot - totalDelivered;
  const isFinished = lot?.status === 'finished';
  const anyActiveOV = ovs.some((o) => o.ov_status === 'in_progress' || o.ov_status === 'pending');

  if (lotQuery.isLoading) {
    return <div className="p-8 text-sm text-text-tertiary">Carregando lote…</div>;
  }

  if (lotQuery.isError || !lot) {
    return (
      <div className="p-8">
        <Link
          href="/logistics/shipments"
          className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="mt-4 text-sm text-error">Não foi possível carregar o lote.</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Top nav */}
      <Link
        href="/logistics/shipments"
        className="inline-flex items-center gap-1 text-sm text-brand-blue hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para embarques
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">
          #ID Lote: {lot.id.slice(0, 8)}…
        </h1>
        <Badge variant={isFinished ? 'success' : 'info'}>
          {isFinished ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Embarque Finalizado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Em andamento
            </span>
          )}
        </Badge>
        <Badge variant={remaining < 0 ? 'warning' : 'default'}>
          A CARREGAR: {formatKg(remaining)} KG
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-tertiary">
        <span>
          <strong className="text-text-primary">Lote:</strong> {baseLot?.lot_number ?? '-'}
        </span>
        <span>
          <strong className="text-text-primary">Liberado em:</strong>{' '}
          {formatDateTime(lot.released_at)}
        </span>
        <span>
          <strong className="text-text-primary">Safra:</strong> {lot.harvest_year || '-'}
        </span>
        <span>
          <strong className="text-text-primary">NF Entrega Futura:</strong>{' '}
          {hasNFFutureDelivery ? 'SIM' : 'NÃO'}
        </span>
        {firstNF && (
          <span>
            <strong className="text-text-primary">Nº NF EF:</strong> {firstNF.nf_number}
          </span>
        )}
      </div>

      {/* Info Cards */}
      <Card className="mt-6">
        <CardHeader className="pb-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">
            Dados do lote
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField label="Filial" value={baseLot?.branch_name} />
            <InfoField
              label="Cliente"
              value={
                <span>
                  {baseLot?.producer_name || '-'}
                  {lot.client_state_registration && (
                    <span className="ml-1 text-text-tertiary">
                      · IE {lot.client_state_registration}
                    </span>
                  )}
                </span>
              }
            />
            <InfoField label="Produto" value={baseLot?.product} />
            <InfoField
              label="Comercial Responsável"
              value={lot.commercial_responsible_name}
            />
            <InfoField
              label="Qtd total lote"
              value={`${formatKg(baseLot?.quantity_kg)} kg`}
            />
            <InfoField
              label="Qtd total entregue"
              value={`${formatKg(totalDelivered)} kg`}
            />
          </div>
        </CardContent>
      </Card>

      {/* OV Section */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-text-primary">Ordens de Venda</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar OV…"
              className="h-9 w-64 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-brand-blue focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={!anyActiveOV}
            onClick={() => {
              const target = ovs.find(
                (o) => o.ov_status === 'in_progress' || o.ov_status === 'pending'
              );
              if (target) setIncreaseOv(target);
            }}
            title={anyActiveOV ? 'Aumentar saldo da OV ativa' : 'Sem OV ativa'}
            className="inline-flex items-center gap-1 rounded-md bg-brand-blue px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Aumentar saldo
          </button>
          <button
            type="button"
            onClick={() => setRegisterManualOpen(true)}
            disabled={isFinished}
            title={
              isFinished ? 'Embarque finalizado' : 'Registrar OV criada diretamente no SAP'
            }
            className="inline-flex items-center gap-1 rounded-md border border-brand-blue px-3 py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue hover:text-white disabled:opacity-40"
          >
            <Edit3 className="h-4 w-4" /> Registrar OV manual
          </button>
        </div>
      </div>

      {ovsQuery.isLoading ? (
        <div className="mt-4 text-sm text-text-tertiary">Carregando OVs…</div>
      ) : filteredOvs.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-text-tertiary">
          {ovs.length === 0
            ? 'Nenhuma OV registrada neste lote ainda.'
            : 'Nenhuma OV corresponde à busca.'}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredOvs.map((ov, idx) => (
            <OVCard
              key={ov.id}
              ov={ov}
              index={idx + 1}
              onAlter={() => setAlterOv(ov)}
              onReprocess={() => setReprocessOv(ov)}
              onComments={() => setCommentsOv(ov)}
            />
          ))}
        </div>
      )}

      {/* NF Section */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-text-primary">NF Entrega Futura</h2>
        {nfQuery.isLoading ? (
          <div className="mt-4 text-sm text-text-tertiary">Carregando NFs…</div>
        ) : nfs.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-text-tertiary">
            Nenhuma NF de Entrega Futura vinculada a este lote.
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase text-text-tertiary">
                      <th className="pb-2 pr-4">Nº NF</th>
                      <th className="pb-2 pr-4">Emissão</th>
                      <th className="pb-2 pr-4">Qtd NF</th>
                      <th className="pb-2 pr-4">Entregue</th>
                      <th className="pb-2 pr-4">Saldo</th>
                      <th className="pb-2 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nfs.map((nf) => (
                      <NFRow key={nf.id} nf={nf} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* placeholder to use anyActiveOV — future enablement of "Alterar"/"Novo" */}
      <div className="sr-only">{anyActiveOV ? 'has-active' : 'no-active'}</div>

      <AlterOvModal
        ov={alterOv}
        isOpen={alterOv !== null}
        onClose={() => setAlterOv(null)}
        onSuccess={() => {
          setAlterOv(null);
          ovsQuery.refetch();
          lotQuery.refetch();
        }}
      />
      <IncreaseBalanceModal
        ov={increaseOv}
        isOpen={increaseOv !== null}
        onClose={() => setIncreaseOv(null)}
        onSuccess={() => {
          setIncreaseOv(null);
          ovsQuery.refetch();
          lotQuery.refetch();
        }}
      />
      <RegisterManualOVModal
        isOpen={registerManualOpen}
        onClose={() => setRegisterManualOpen(false)}
        managedLotId={lot.id}
        lotNumber={lotNumber}
        remainingKg={remaining}
        onSuccess={() => {
          ovsQuery.refetch();
          lotQuery.refetch();
        }}
      />
      <ReprocessOvModal
        ov={reprocessOv}
        isOpen={reprocessOv !== null}
        onClose={() => setReprocessOv(null)}
        onSuccess={() => {
          setReprocessOv(null);
          ovsQuery.refetch();
          lotQuery.refetch();
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

function OVCard({
  ov,
  index,
  onAlter,
  onReprocess,
  onComments,
}: {
  ov: SalesOrder;
  index: number;
  onAlter: () => void;
  onReprocess: () => void;
  onComments: () => void;
}) {
  const totalOc = ov.loading_orders.length;
  const active = ov.ov_status === 'in_progress' || ov.ov_status === 'pending';
  const hasRpaIssue = ov.rpa_status === 'error';
  const isException =
    ov.rpa_error_type === 'business_exception' ||
    ov.rpa_error_type === 'system_exception';

  const dmTaskQuery = useQuery({
    queryKey: ['rpa-dm-ticket', ov.id],
    queryFn: () =>
      rpaTasksApi.list({
        task_type: 'desk_manager_ticket',
        related_object_type: 'sales_order',
        related_object_id: ov.id,
        page_size: 1,
        ordering: '-created_at',
      }),
    enabled: hasRpaIssue,
    refetchInterval: hasRpaIssue ? 30_000 : false,
  });
  const dmTask = dmTaskQuery.data?.results?.[0];

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <h3 className="text-base font-semibold text-text-primary">
          {index}º OV: {ov.ov_number || '— pendente —'}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={OV_STATUS_VARIANT[ov.ov_status]}>{ov.ov_status_display}</Badge>
          {hasRpaIssue && dmTask && (
            <span
              title={
                dmTask.status === 'completed'
                  ? `Chamado Desk Manager aberto pelo RPA: ${dmTask.external_reference}`
                  : dmTask.status === 'error'
                    ? 'Falha ao abrir chamado Desk Manager'
                    : 'Chamado Desk Manager em abertura'
              }
            >
              <Badge
                variant={
                  dmTask.status === 'completed'
                    ? 'success'
                    : dmTask.status === 'error'
                      ? 'error'
                      : 'warning'
                }
              >
                {dmTask.status === 'completed' && dmTask.external_reference
                  ? `Chamado ${dmTask.external_reference}`
                  : dmTask.status === 'error'
                    ? 'Chamado com erro'
                    : 'Chamado pendente'}
              </Badge>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs uppercase tracking-wide text-text-tertiary">
          {ov.billing_branch_name || 'Filial —'}
        </div>

        {/* Exception banner */}
        {isException && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 ${
              ov.rpa_error_type === 'business_exception'
                ? 'border-orange-200 bg-orange-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            {ov.rpa_error_type === 'business_exception' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            ) : (
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-semibold ${
                  ov.rpa_error_type === 'business_exception'
                    ? 'text-orange-700'
                    : 'text-red-700'
                }`}
              >
                {ov.rpa_error_type === 'business_exception'
                  ? 'Exceção de Negócio'
                  : 'Exceção de Sistema'}
              </p>
              {ov.rpa_error_message && (
                <p
                  className={`mt-0.5 truncate font-mono text-xs ${
                    ov.rpa_error_type === 'business_exception'
                      ? 'text-orange-600'
                      : 'text-red-600'
                  }`}
                  title={ov.rpa_error_message}
                >
                  {ov.rpa_error_message}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <div className="flex-1">
            <div className="text-xs text-text-tertiary">LOCAL DE TRANSBORDO</div>
            <div className="font-medium text-text-primary">
              {ov.transshipment_location_name || '—'}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-text-tertiary" />
          <div className="flex-1 text-right">
            <div className="text-xs text-text-tertiary">DESTINO FINAL</div>
            <div className="font-medium text-text-primary">
              {ov.terminal_destination_name || '—'}
            </div>
          </div>
        </div>

        <div className="text-sm">
          <span className="text-text-primary">{ov.billing_producer_name || '-'}</span>
          {ov.client_state_registration && (
            <span className="ml-1 text-text-tertiary">
              · IE {ov.client_state_registration}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-sm">
          <div>
            <div className="text-xs text-text-tertiary">Qtd total OV</div>
            <div className="font-medium">{formatKg(ov.total_quantity_kg)} kg</div>
          </div>
          <div>
            <div className="text-xs text-text-tertiary">Entregue</div>
            <div className="font-medium">{formatKg(ov.delivered_quantity_kg)} kg</div>
          </div>
          <div>
            <div className="text-xs text-text-tertiary">Saldo</div>
            <div className="font-medium">{formatKg(ov.balance_kg)} kg</div>
          </div>
        </div>

        {ov.closed_at && (
          <div className="text-xs text-text-tertiary">
            Encerrado em {formatDate(ov.closed_at)}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="text-xs text-text-tertiary">
            {totalOc} ordem{totalOc === 1 ? '' : 's'} de carregamento
          </div>
          <div className="flex items-center gap-2">
            {isException && (
              <button
                type="button"
                onClick={onReprocess}
                title="Reprocessar OV — clonar para nova tentativa via RPA"
                className="inline-flex items-center gap-1 rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reprocessar
              </button>
            )}
            <button
              type="button"
              onClick={onComments}
              title="Comentários e observações"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-slate-50"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Comentários
            </button>
            <button
              type="button"
              disabled
              title="Em breve"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-slate-50 disabled:opacity-40"
            >
              <Edit3 className="h-3.5 w-3.5" /> Editar
            </button>
            <button
              type="button"
              disabled={!active}
              onClick={onAlter}
              title={active ? 'Encerrar esta OV e criar uma nova com o saldo' : 'OV encerrada'}
              className="inline-flex items-center gap-1 rounded-md bg-brand-blue px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Alterar
            </button>
          </div>
        </div>

        {ov.loading_orders.length > 0 && <OCTable loadingOrders={ov.loading_orders} />}
      </CardContent>
    </Card>
  );
}

function OCTable({ loadingOrders }: { loadingOrders: LoadingOrder[] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-slate-100">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50">
          <tr className="text-left text-text-tertiary">
            <th className="px-3 py-2">Nº OC</th>
            <th className="px-3 py-2">Placa</th>
            <th className="px-3 py-2">Criação</th>
            <th className="px-3 py-2">Vencimento</th>
            <th className="px-3 py-2">Peso</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {loadingOrders.map((oc) => (
            <tr key={oc.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-text-primary">{oc.oc_number}</td>
              <td className="px-3 py-2">{oc.plate || '-'}</td>
              <td className="px-3 py-2">{formatDate(oc.created_at)}</td>
              <td className="px-3 py-2">{formatDate(oc.expires_at)}</td>
              <td className="px-3 py-2">{formatKg(oc.weight_kg)} kg</td>
              <td className="px-3 py-2">
                <Badge variant={oc.status === 'active' ? 'success' : 'default'}>
                  {oc.status_display}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NFRow({ nf }: { nf: NFFutureDelivery }) {
  return (
    <tr className="border-b border-slate-50 last:border-b-0">
      <td className="py-3 pr-4 font-medium text-text-primary">{nf.nf_number}</td>
      <td className="py-3 pr-4">{formatDate(nf.issue_date)}</td>
      <td className="py-3 pr-4">{formatKg(nf.quantity_kg)} kg</td>
      <td className="py-3 pr-4">{formatKg(nf.delivered_quantity_kg)} kg</td>
      <td className="py-3 pr-4">{formatKg(nf.remaining_quantity_kg)} kg</td>
      <td className="py-3 pr-4">
        <Badge variant={nf.status === 'finished' ? 'success' : 'info'}>
          {nf.status_display}
        </Badge>
      </td>
    </tr>
  );
}
