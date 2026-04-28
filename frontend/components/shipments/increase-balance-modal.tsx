'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Modal } from '@/components/ui/modal';
import { ordersApi, type SalesOrder } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/errors';
import { notify } from '@/lib/notify';

interface IncreaseBalanceModalProps {
  ov: SalesOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LIMIT_KG = 55000;

export function IncreaseBalanceModal({
  ov,
  isOpen,
  onClose,
  onSuccess,
}: IncreaseBalanceModalProps) {
  const queryClient = useQueryClient();
  const [added, setAdded] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAdded('');
      setError(null);
    }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!ov) throw new Error('OV inválida.');
      return ordersApi.increaseBalance(ov.id, added);
    },
    onSuccess: () => {
      notify.success('Saldo aumentado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['managed-lot'] });
      onSuccess();
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Não foi possível aumentar o saldo.'));
    },
  });

  if (!ov) return null;

  const balanceNum = Number(ov.balance_kg);
  const hasNf = ov.nf_future_delivery !== null;
  const blocked = hasNf || balanceNum >= LIMIT_KG;
  const addedNum = Number(added);
  const canSubmit = !blocked && addedNum > 0 && !Number.isNaN(addedNum);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => (!mutation.isPending ? onClose() : null)}
      title={`Aumentar saldo — OV ${ov.ov_number || '— pendente —'}`}
      closeOnEscape={!mutation.isPending}
      className="max-w-md"
    >
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-xs text-text-secondary">
          <div>
            <div className="text-text-tertiary">Saldo atual</div>
            <div className="text-sm font-semibold text-text-primary">
              {balanceNum.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
            </div>
          </div>
          <div>
            <div className="text-text-tertiary">NF Entrega Futura</div>
            <div className="text-sm font-semibold text-text-primary">
              {hasNf ? ov.nf_future_delivery_number || 'vinculada' : '—'}
            </div>
          </div>
        </div>

        {blocked && (
          <div
            role="alert"
            className="rounded-md bg-warning-light px-3 py-2 text-sm text-warning"
          >
            {hasNf
              ? 'OV vinculada a NF Entrega Futura não aceita aumento de saldo. Use "Alterar OV".'
              : `Saldo atual acima de ${LIMIT_KG.toLocaleString('pt-BR')} kg — aumento não permitido. Use "Alterar OV".`}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-text-primary">
            Quantidade a adicionar (kg) <span className="text-error">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={added}
            disabled={blocked}
            onChange={(e) => setAdded(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none disabled:bg-slate-50"
          />
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
          disabled={mutation.isPending}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Salvando…' : 'Aumentar saldo'}
        </button>
      </div>
    </Modal>
  );
}
