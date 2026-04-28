'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, Eye, FileText } from 'lucide-react';

import { invoicesApi, type ChildNF } from '@/lib/api/invoices';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/lib/errors';
import { CorrectionLetterModal } from './correction-letter-modal';

interface ChildrenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  motherNfId: string | null;
  motherNfNumber?: string;
}

function formatDecimal(value: string | number | null | undefined, digits = 3) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function StatusBadge({ child }: { child: ChildNF }) {
  if (child.validation_status === 'valid') {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Válida
      </Badge>
    );
  }
  if (child.validation_status === 'invalid') {
    return (
      <Badge variant="error">
        <AlertCircle className="mr-1 h-3 w-3" /> Inválida
      </Badge>
    );
  }
  if (child.validation_status === 'needs_review') {
    return (
      <Badge variant="warning">
        <Eye className="mr-1 h-3 w-3" /> Revisar
      </Badge>
    );
  }
  return (
    <Badge variant="default">
      <Clock className="mr-1 h-3 w-3" /> Pendente
    </Badge>
  );
}

export function ChildrenDetailModal({
  isOpen,
  onClose,
  motherNfId,
  motherNfNumber,
}: ChildrenDetailModalProps) {
  const [cceChild, setCceChild] = useState<ChildNF | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['nf-children', motherNfId],
    queryFn: () => invoicesApi.getMotherChildren(motherNfId!),
    enabled: isOpen && !!motherNfId,
  });

  const rows: ChildNF[] = data?.results ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Validação — NFs filhas${motherNfNumber ? ` (NF mãe ${motherNfNumber})` : ''}`}
      closeOnEscape
    >
      <div className="p-6">
        {isLoading && (
          <p className="text-sm text-text-tertiary">Carregando NFs filhas…</p>
        )}
        {error && (
          <div role="alert" className="rounded-md bg-error-light px-3 py-2 text-sm text-error">
            {getErrorMessage(error, 'Erro ao carregar NFs filhas.')}
          </div>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <p className="text-sm text-text-tertiary">
            Nenhuma NF filha registrada para esta NF mãe.
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase text-text-tertiary">
                  <th className="px-2 py-2">Nº NF filha</th>
                  <th className="px-2 py-2">Emissão</th>
                  <th className="px-2 py-2">Qtd (kg)</th>
                  <th className="px-2 py-2">Vlr unit.</th>
                  <th className="px-2 py-2">Nível</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Erro / detalhe</th>
                  <th className="px-2 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((child) => (
                  <tr key={child.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2 font-mono">{child.nf_number || '-'}</td>
                    <td className="px-2 py-2">{formatDate(child.issue_date)}</td>
                    <td className="px-2 py-2">{formatDecimal(child.quantity_kg)}</td>
                    <td className="px-2 py-2">{formatCurrency(child.unit_value)}</td>
                    <td className="px-2 py-2">
                      {child.validation_level ? `N${child.validation_level}` : '-'}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge child={child} />
                    </td>
                    <td className="px-2 py-2">
                      {child.validation_error_message ? (
                        <div>
                          <div className="font-medium text-error">
                            {child.validation_error_message}
                          </div>
                          {child.validation_detail && (
                            <div className="text-xs text-text-tertiary">
                              {child.validation_detail}
                            </div>
                          )}
                          {child.has_correction_letter && (
                            <div className="mt-1 text-xs text-brand-blue">
                              CCe registrada — nova mãe:{' '}
                              <span className="font-mono">
                                {child.correction_new_mother_ref || '—'}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : child.has_correction_letter ? (
                        <div className="text-xs text-brand-blue">
                          CCe registrada — nova mãe:{' '}
                          <span className="font-mono">
                            {child.correction_new_mother_ref || '—'}
                          </span>
                        </div>
                      ) : (
                        child.validation_detail || '-'
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {(child.validation_status === 'invalid' ||
                        child.validation_status === 'needs_review') && (
                        <button
                          type="button"
                          onClick={() => setCceChild(child)}
                          className="inline-flex items-center gap-1 rounded-md border border-brand-blue px-2 py-1 text-xs text-brand-blue hover:bg-brand-blue hover:text-white"
                          title="Registrar Carta de Correção"
                        >
                          <FileText className="h-3 w-3" /> CCe
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CorrectionLetterModal
        isOpen={!!cceChild}
        onClose={() => setCceChild(null)}
        child={cceChild}
      />
    </Modal>
  );
}
