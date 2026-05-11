'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { ordersApi, type SalesOrder } from '@/lib/api/orders';
import { getErrorMessage } from '@/lib/errors';
import { notify } from '@/lib/notify';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface OvCommentsModalProps {
  ov: SalesOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OvCommentsModal({ ov, isOpen, onClose }: OvCommentsModalProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const commentsQuery = useQuery({
    queryKey: ['ov-comments', ov?.id],
    queryFn: () => ordersApi.listComments(ov!.id),
    enabled: isOpen && !!ov,
  });

  const addCommentMutation = useMutation({
    mutationFn: () => {
      if (!ov) throw new Error('OV inválida.');
      return ordersApi.addComment(ov.id, text.trim());
    },
    onSuccess: () => {
      notify.success('Comentário adicionado.');
      queryClient.invalidateQueries({ queryKey: ['ov-comments', ov?.id] });
      setText('');
    },
    onError: (err) => {
      void err;
    },
  });

  if (!ov) return null;

  const comments = commentsQuery.data ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Comentários — OV ${ov.ov_number || ov.id.slice(0, 8) + '…'}`}
      closeOnEscape
    >
      <div className="flex flex-col gap-4">
        {/* Comment list */}
        {commentsQuery.isLoading ? (
          <div className="flex flex-col gap-2 py-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex animate-pulse gap-3 py-2">
                <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-3 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-full rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length > 0 ? (
          <div className="flex max-h-64 flex-col gap-0 overflow-y-auto pr-1">
            {comments.map((comment, idx) => (
              <div key={comment.id}>
                <div className="flex gap-3 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-xs font-semibold text-brand-blue select-none">
                    {getInitials(comment.user_display)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {comment.user_display}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {formatDateTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                      {comment.text}
                    </p>
                  </div>
                </div>
                {idx < comments.length - 1 && (
                  <div className="ml-11 border-b border-slate-100" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-6 text-text-tertiary">
            <MessageSquare className="h-6 w-6" />
            <p className="text-sm">Nenhum comentário ainda.</p>
          </div>
        )}

        {/* New comment */}
        <div className="border-t border-slate-100 pt-3">
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            Novo comentário
          </label>
          <textarea
            className="w-full resize-y rounded-lg border border-slate-200 p-3 text-sm text-text-primary focus:border-brand-blue focus:outline-none"
            rows={3}
            placeholder="Descreva a observação…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {addCommentMutation.isError && (
            <p className="mt-1 text-xs text-error">
              {getErrorMessage(addCommentMutation.error)}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-50"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => addCommentMutation.mutate()}
            disabled={!text.trim() || addCommentMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {addCommentMutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
