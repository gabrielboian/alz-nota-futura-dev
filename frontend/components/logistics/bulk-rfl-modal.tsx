'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { ordersApi } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/errors';

interface BulkRFLModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSuccess: (updated: number) => void;
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function BulkRFLModal({
  isOpen,
  onClose,
  selectedIds,
  onSuccess,
}: BulkRFLModalProps) {
  const [rflKg, setRflKg] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rflNumber = useMemo(() => {
    const normalized = rflKg.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [rflKg]);

  const rflSack = rflNumber !== null ? rflNumber * 60 : null;

  function reset() {
    setRflKg('');
    setConfirmed(false);
    setSubmitting(false);
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!rflNumber || !confirmed || selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await ordersApi.bulkRfl(selectedIds, rflNumber);
      onSuccess(result.updated);
      reset();
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível atualizar os valores de RFL.'));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Ajuste Valor RFL em massa"
      closeOnEscape
    >
      <div className="space-y-4 p-6">
        <p className="text-sm text-text-primary">
          Total de <strong>{selectedIds.length}</strong> ordens de venda
          selecionadas.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Valor de pauta RFL (R$/kg)
          </label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={rflKg}
            onChange={(e) => setRflKg(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none disabled:bg-slate-50"
            placeholder="0,0000"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-tertiary">
            R$/saca (60 kg)
          </label>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-secondary">
            {rflSack !== null ? `R$ ${formatNumber(rflSack)}` : '—'}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Após este lançamento, as Ordens de Carregamento (OCs) vinculadas às
            OVs antigas falharão no SAP. A logística precisará abrir um chamado
            manual para a operação reatribuir as OCs às novas OVs.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            Estou ciente que estou realizando o procedimento de atualização de
            valores em massa.
          </span>
        </label>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          {confirmed && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!rflNumber || submitting}
              className="rounded-md bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Lançando…' : 'Lançar'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
