'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Modal } from '@/components/ui/modal';
import { ordersApi } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/errors';
import { notify } from '@/lib/notify';

interface RegisterManualOVModalProps {
  isOpen: boolean;
  onClose: () => void;
  managedLotId: string;
  lotNumber: string;
  remainingKg: number;
  onSuccess: () => void;
}

function formatKg(n: number) {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export function RegisterManualOVModal({
  isOpen,
  onClose,
  managedLotId,
  lotNumber,
  remainingKg,
  onSuccess,
}: RegisterManualOVModalProps) {
  const queryClient = useQueryClient();
  const [ovNumber, setOvNumber] = useState('');
  const [qty, setQty] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOvNumber('');
      setQty('');
      setError(null);
    }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: () =>
      ordersApi.registerManual({
        managed_lot: managedLotId,
        ov_number: ovNumber.trim(),
        total_quantity_kg: qty.trim().replace(',', '.'),
      }),
    onSuccess: () => {
      notify.success('OV registrada manualmente.');
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['managed-lot', managedLotId] });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Não foi possível registrar a OV.'));
    },
  });

  function handleSubmit() {
    if (!ovNumber.trim()) {
      setError('Informe o número da OV do SAP.');
      return;
    }
    const qtyNum = parseFloat(qty.replace(',', '.'));
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError('Quantidade deve ser maior que zero.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={mutation.isPending ? () => {} : onClose}
      title="Registrar OV manualmente"
      closeOnEscape
    >
      <div className="space-y-4 p-6">
        <div className="rounded-md bg-surface-secondary px-3 py-2 text-sm">
          <div>
            <strong>Lote:</strong> {lotNumber}
          </div>
          <div>
            <strong>Saldo disponível:</strong> {formatKg(remainingKg)} kg
          </div>
        </div>

        <p className="text-sm text-text-secondary">
          Use esta opção quando a OV já foi criada diretamente no SAP e não passou
          pelo RPA. Este registro será marcado como "criado manualmente" e não será
          reprocessado automaticamente.
        </p>

        {error && (
          <div role="alert" className="rounded-md bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text-primary">
            Nº da OV (SAP)
          </label>
          <input
            type="text"
            value={ovNumber}
            onChange={(e) => setOvNumber(e.target.value)}
            disabled={mutation.isPending}
            className="mt-1 block h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none"
            placeholder="Ex.: 4000123456"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary">
            Quantidade total (kg)
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={mutation.isPending}
            className="mt-1 block h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-text-secondary hover:bg-surface-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Registrando…' : 'Registrar OV'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
