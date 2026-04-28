'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invoicesApi, type ChildNF } from '@/lib/api/invoices';
import { Modal } from '@/components/ui/modal';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Input } from '@/components/ui/input';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/errors';

interface CorrectionLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  child: ChildNF | null;
}

export function CorrectionLetterModal({ isOpen, onClose, child }: CorrectionLetterModalProps) {
  const queryClient = useQueryClient();
  const [newMotherRef, setNewMotherRef] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!child) throw new Error('NF filha não selecionada.');
      return invoicesApi.reprocessCorrection(child.id, {
        new_mother_ref: newMotherRef.trim(),
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      setError(null);
      setNewMotherRef('');
      setNote('');
      notify.success('Carta de correção registrada. Revalidação enfileirada para o RPA.');
      queryClient.invalidateQueries({ queryKey: ['nf-children'] });
      queryClient.invalidateQueries({ queryKey: ['nf-future-delivery'] });
      onClose();
    },
    onError: (err) => {
      setError(getErrorMessage(err, 'Não foi possível registrar a Carta de Correção.'));
    },
  });

  function handleSubmit() {
    if (!newMotherRef.trim()) {
      setError('Informe a chave ou número da nova NF mãe.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  function handleClose() {
    if (mutation.isPending) return;
    setError(null);
    setNewMotherRef('');
    setNote('');
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Registrar Carta de Correção (CCe)"
      closeOnEscape
    >
      <div className="p-6 space-y-4">
        <p className="text-sm text-text-secondary">
          Registre a Carta de Correção Eletrônica emitida para esta NF filha. O sistema irá
          atualizar a referência da NF mãe e enfileirar uma nova validação via RPA.
        </p>

        {child && (
          <div className="rounded-md bg-surface-secondary px-3 py-2 text-sm">
            <div>
              <strong>NF filha:</strong> {child.nf_number || '—'}{' '}
              {child.nf_key ? `(chave ${child.nf_key})` : ''}
            </div>
            <div>
              <strong>NF mãe atual:</strong> {child.mother_nf_number || '—'}
            </div>
            {child.validation_error_message && (
              <div className="mt-1 text-error">
                <strong>Motivo:</strong> {child.validation_error_message}
              </div>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-md bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        <Input
          label="Nova NF mãe (chave de 44 dígitos ou número)"
          value={newMotherRef}
          onChange={(e) => setNewMotherRef(e.target.value)}
          placeholder="Ex.: 35250212345678000191550010000012341234567890 ou 000012345"
          disabled={mutation.isPending}
          required
        />

        <Input
          label="Observação (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex.: CCe protocolo 123456"
          disabled={mutation.isPending}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <ButtonPrimary onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Processando…' : 'Registrar CCe'}
          </ButtonPrimary>
        </div>
      </div>
    </Modal>
  );
}
