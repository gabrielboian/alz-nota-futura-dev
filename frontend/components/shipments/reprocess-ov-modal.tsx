'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Image as ImageIcon, RefreshCw, Zap } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { ordersApi, type SalesOrder } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/errors';
import { notify } from '@/lib/notify';

function formatKg(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

interface DataRowProps {
  label: string;
  value: React.ReactNode;
}

function DataRow({ label, value }: DataRowProps) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-text-primary">{value || '-'}</div>
    </div>
  );
}

interface ReprocessOvModalProps {
  ov: SalesOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReprocessOvModal({
  ov,
  isOpen,
  onClose,
  onSuccess,
}: ReprocessOvModalProps) {
  const queryClient = useQueryClient();

  const reprocessMutation = useMutation({
    mutationFn: () => {
      if (!ov) throw new Error('OV inválida.');
      return ordersApi.reprocess(ov.id);
    },
    onSuccess: () => {
      notify.success('OV reenviada para criação. Nova OV gerada na fila do RPA.');
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['managed-lot'] });
      onSuccess();
    },
    onError: (err) => {
      // inline error via mutation.error — displayed below
      void err;
    },
  });

  if (!ov) return null;

  const isBusinessException = ov.rpa_error_type === 'business_exception';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reprocessar OV"
      className="max-w-2xl w-full"
      closeOnEscape
    >
      <div className="flex flex-col gap-5">
        {/* Error type badge */}
        <div className="flex items-center gap-2">
          {isBusinessException ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Exceção de Negócio
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
              <Zap className="h-3.5 w-3.5" />
              Exceção de Sistema
            </span>
          )}
          {ov.rpa_last_attempt_at && (
            <span className="text-xs text-text-tertiary">
              Última tentativa: {formatDateTime(ov.rpa_last_attempt_at)}
              {ov.rpa_retry_count > 0 && ` · ${ov.rpa_retry_count}ª tentativa`}
            </span>
          )}
        </div>

        {/* Error block */}
        {(ov.rpa_error_message || ov.rpa_traceback) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            {ov.rpa_error_message && (
              <div className="mb-2">
                <p className="mb-1 text-xs font-semibold text-red-600">
                  Mensagem de erro
                </p>
                <p className="break-all font-mono text-sm text-red-800">
                  {ov.rpa_error_message}
                </p>
              </div>
            )}
            {ov.rpa_traceback && (
              <details>
                <summary className="cursor-pointer select-none text-xs font-semibold text-red-600">
                  Traceback
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-red-100 p-2 text-xs text-red-700">
                  {ov.rpa_traceback}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Screenshot */}
        {ov.rpa_screenshot && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-text-tertiary">
              <ImageIcon className="h-3.5 w-3.5" /> Screenshot do erro
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ov.rpa_screenshot}
              alt="Screenshot do erro RPA"
              className="max-h-48 rounded-lg border border-slate-200 object-contain"
            />
          </div>
        )}

        {/* OV data summary */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            Dados principais da OV
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <DataRow label="Nº OV" value={ov.ov_number || '— pendente —'} />
            <DataRow label="Produto" value={ov.product} />
            <DataRow label="Safra" value={ov.harvest_year} />
            <DataRow label="Produtor faturamento" value={ov.billing_producer_name} />
            <DataRow label="IE cliente" value={ov.client_state_registration} />
            <DataRow label="Filial" value={ov.billing_branch_name} />
            <DataRow
              label="Transbordo"
              value={ov.transshipment_location_name}
            />
            <DataRow label="Terminal destino" value={ov.terminal_destination_name} />
            <DataRow
              label="Qtd total OV"
              value={`${formatKg(ov.total_quantity_kg)} kg`}
            />
            <DataRow label="Saldo" value={`${formatKg(ov.balance_kg)} kg`} />
            <DataRow label="RFL (R$/kg)" value={ov.rfl_value_kg} />
            <DataRow label="Frete" value={ov.freight_value} />
          </div>
        </div>

        {/* Inline error */}
        {reprocessMutation.isError && (
          <p className="text-sm text-error">
            {getErrorMessage(reprocessMutation.error)}
          </p>
        )}

        {/* Explanation note */}
        <p className="text-xs text-text-tertiary">
          Ao confirmar, a OV atual será invalidada e uma nova cópia idêntica será
          criada na fila de criação do RPA (sem alteração de dados).
        </p>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={reprocessMutation.isPending}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => reprocessMutation.mutate()}
            disabled={reprocessMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            {reprocessMutation.isPending ? 'Reprocessando…' : 'Reprocessar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
