'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Modal } from '@/components/ui/modal';
import { lookupsApi } from '@/lib/api/lookups';
import { ordersApi, type SalesOrder } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/errors';
import { notify } from '@/lib/notify';

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

interface AlterOvModalProps {
  ov: SalesOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AlterOvModal({ ov, isOpen, onClose, onSuccess }: AlterOvModalProps) {
  const queryClient = useQueryClient();
  const [terminal, setTerminal] = useState('');
  const [transshipment, setTransshipment] = useState('');
  const [rflKg, setRflKg] = useState('');
  const [freight, setFreight] = useState('');
  const [billingProducer, setBillingProducer] = useState('');
  const [ie, setIe] = useState('');
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && ov) {
      setTerminal(ov.terminal_destination ?? '');
      setTransshipment(ov.transshipment_location ?? '');
      setRflKg(ov.rfl_value_kg ?? '');
      setFreight(ov.freight_value ?? '');
      setBillingProducer(ov.billing_producer_name ?? '');
      setIe(ov.client_state_registration ?? '');
      const activeIds = ov.loading_orders
        .filter((oc) => oc.status === 'active')
        .map((oc) => oc.id);
      setKeepIds(new Set(activeIds));
      setError(null);
    }
  }, [isOpen, ov]);

  const terminalsQuery = useQuery({
    queryKey: ['lookup-terminals'],
    queryFn: lookupsApi.terminals,
    enabled: isOpen,
  });
  const transshipmentsQuery = useQuery({
    queryKey: ['lookup-transshipments'],
    queryFn: lookupsApi.transshipments,
    enabled: isOpen,
  });

  const alterMutation = useMutation({
    mutationFn: async () => {
      if (!ov) throw new Error('OV inválida.');
      return ordersApi.alter(ov.id, {
        terminal_destination: terminal,
        transshipment_location: transshipment || null,
        rfl_value_kg: rflKg,
        freight_value: freight,
        billing_producer_name: billingProducer.trim() || undefined,
        client_state_registration: ie.trim() || undefined,
        keep_loading_order_ids: Array.from(keepIds),
      });
    },
    onSuccess: () => {
      notify.success('OV alterada. Nova OV criada com o saldo remanescente.');
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['managed-lot'] });
      onSuccess();
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Não foi possível alterar a OV.'));
    },
  });

  const canSubmit = useMemo(() => {
    if (!ov) return false;
    if (!terminal) return false;
    if (!rflKg || Number(rflKg) <= 0) return false;
    if (!freight || Number(freight) < 0) return false;
    return true;
  }, [ov, terminal, rflKg, freight]);

  const hasChanges = useMemo(() => {
    if (!ov) return false;
    if (terminal !== (ov.terminal_destination ?? '')) return true;
    if (transshipment !== (ov.transshipment_location ?? '')) return true;
    if (rflKg !== (ov.rfl_value_kg ?? '')) return true;
    if (freight !== (ov.freight_value ?? '')) return true;
    if (billingProducer !== (ov.billing_producer_name ?? '')) return true;
    if (ie !== (ov.client_state_registration ?? '')) return true;
    const initialActive = new Set(
      ov.loading_orders.filter((oc) => oc.status === 'active').map((oc) => oc.id),
    );
    if (initialActive.size !== keepIds.size) return true;
    for (const id of keepIds) {
      if (!initialActive.has(id)) return true;
    }
    return false;
  }, [ov, terminal, transshipment, rflKg, freight, billingProducer, ie, keepIds]);

  const totals = useMemo(() => {
    if (!ov) return { ov: 0, delivered: 0, carrying: 0, saldo: 0 };
    const totalOv = Number(ov.total_quantity_kg || 0);
    const delivered = Number(ov.delivered_quantity_kg || 0);
    const carrying = ov.loading_orders
      .filter((oc) => keepIds.has(oc.id))
      .reduce((acc, oc) => acc + Number(oc.weight_kg || 0), 0);
    const saldo = totalOv - delivered - carrying;
    return { ov: totalOv, delivered, carrying, saldo };
  }, [ov, keepIds]);

  function toggleKeep(id: string) {
    setKeepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!ov) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => (!alterMutation.isPending ? onClose() : null)}
      title={`Alterar OV ${ov.ov_number || '— pendente —'}`}
      closeOnEscape={!alterMutation.isPending}
      className="max-w-3xl"
    >
      <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
        <p className="text-sm text-text-secondary">
          A OV atual será <strong>encerrada</strong> e uma nova OV será criada com o saldo
          remanescente de{' '}
          <strong>
            {Number(ov.balance_kg).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
          </strong>
          . Marque abaixo quais ordens de carregamento ativas devem ser mantidas na nova OV.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-primary">
              Terminal destino <span className="text-error">*</span>
            </label>
            <select
              value={terminal}
              onChange={(e) => setTerminal(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            >
              <option value="">Selecione…</option>
              {(terminalsQuery.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-primary">
              Local transbordo
            </label>
            <select
              value={transshipment}
              onChange={(e) => setTransshipment(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            >
              <option value="">Sem transbordo</option>
              {(transshipmentsQuery.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-primary">
              Valor pauta RFL (R$/kg) <span className="text-error">*</span>
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={rflKg}
              onChange={(e) => setRflKg(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-primary">
              Valor frete (R$/ton) <span className="text-error">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-primary">
              Produtor faturamento
            </label>
            <input
              type="text"
              value={billingProducer}
              onChange={(e) => setBillingProducer(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-primary">
              Inscrição estadual cliente
            </label>
            <input
              type="text"
              value={ie}
              onChange={(e) => setIe(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-text-primary">
            Ordens de carregamento ({ov.loading_orders.length})
          </h3>
          {ov.loading_orders.length === 0 ? (
            <p className="text-sm text-text-tertiary">Nenhuma OC registrada nesta OV.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-left text-text-tertiary">
                    <th className="px-3 py-2 w-10"></th>
                    <th className="px-3 py-2">Nº OC</th>
                    <th className="px-3 py-2">Placa</th>
                    <th className="px-3 py-2">Criação</th>
                    <th className="px-3 py-2">Vencimento</th>
                    <th className="px-3 py-2">Peso (kg)</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ov.loading_orders.map((oc) => {
                    const checked = keepIds.has(oc.id);
                    const isInactive = oc.status !== 'active';
                    return (
                      <tr
                        key={oc.id}
                        className={`border-t border-slate-100 ${isInactive ? 'opacity-50' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand-blue"
                            checked={checked}
                            onChange={() => toggleKeep(oc.id)}
                            disabled={isInactive}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-text-primary">
                          {oc.oc_number}
                        </td>
                        <td className="px-3 py-2">{oc.plate || '-'}</td>
                        <td className="px-3 py-2">{formatDate(oc.created_at)}</td>
                        <td className="px-3 py-2">{formatDate(oc.expires_at)}</td>
                        <td className="px-3 py-2">
                          {Number(oc.weight_kg).toLocaleString('pt-BR', {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-3 py-2">{oc.status_display}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-text-tertiary">
            OCs marcadas serão reatribuídas à nova OV. As desmarcadas serão inativadas.
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-text-tertiary">Qtd total OV</div>
              <div className="font-semibold text-text-primary">
                {totals.ov.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
              </div>
            </div>
            <div>
              <div className="text-xs text-text-tertiary">Qtd total entregue</div>
              <div className="font-semibold text-text-primary">
                {totals.delivered.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
              </div>
            </div>
            <div>
              <div className="text-xs text-text-tertiary">Qtd a carregar</div>
              <div className="font-semibold text-text-primary">
                {totals.carrying.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
              </div>
            </div>
            <div>
              <div className="text-xs text-text-tertiary">Saldo nova OV</div>
              <div
                className={`font-semibold ${
                  totals.saldo < 0 ? 'text-error' : 'text-text-primary'
                }`}
              >
                {totals.saldo.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-md bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          disabled={alterMutation.isPending}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => alterMutation.mutate()}
          disabled={!canSubmit || !hasChanges || alterMutation.isPending}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
        >
          {alterMutation.isPending ? 'Alterando…' : 'Alterar OV'}
        </button>
      </div>
    </Modal>
  );
}
