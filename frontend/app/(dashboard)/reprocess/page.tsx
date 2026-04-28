'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, RotateCw } from 'lucide-react';

import {
  rpaTasksApi,
  type RpaDispatchTask,
  type RpaTaskStatus,
  type RpaTaskType,
} from '@/lib/api/rpa-tasks';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/errors';
import { useUrlPagination } from '@/lib/hooks/use-url-pagination';

const STATUS_OPTIONS: { value: RpaTaskStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em execução' },
  { value: 'completed', label: 'Concluído' },
  { value: 'error', label: 'Erro' },
];

const TYPE_OPTIONS: { value: RpaTaskType | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'fiscal_instruction_email', label: 'Instrução fiscal (e-mail)' },
  { value: 'fiscal_instruction_whatsapp', label: 'Instrução fiscal (WhatsApp)' },
  { value: 'desk_manager_ticket', label: 'Chamado Desk Manager' },
];

const STATUS_BADGE: Record<RpaTaskStatus, BadgeVariant> = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
  error: 'error',
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReprocessPage() {
  const queryClient = useQueryClient();
  const { page, pageSize, setPage, setPageSize } = useUrlPagination();

  const [statusFilter, setStatusFilter] = useState<RpaTaskStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<RpaTaskType | ''>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailTask, setDetailTask] = useState<RpaDispatchTask | null>(null);

  const listParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { task_type: typeFilter } : {}),
    }),
    [page, pageSize, statusFilter, typeFilter],
  );

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['rpa-tasks', listParams],
    queryFn: () => rpaTasksApi.list(listParams),
    refetchInterval: 15000,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['rpa-tasks'] });
  }

  const requeueMutation = useMutation({
    mutationFn: (id: string) => rpaTasksApi.requeue(id),
    onSuccess: () => {
      notify.success('Tarefa reenfileirada.');
      invalidate();
    },
    onError: (err) => {
      notify.error(getErrorMessage(err, 'Não foi possível reenfileirar a tarefa.'));
    },
  });

  const bulkRequeueMutation = useMutation({
    mutationFn: (ids: string[]) => rpaTasksApi.bulkRequeue(ids),
    onSuccess: (res) => {
      notify.success(`${res.updated} tarefa(s) reenfileirada(s).`);
      setSelected(new Set());
      invalidate();
    },
    onError: (err) => {
      notify.error(getErrorMessage(err, 'Não foi possível reenfileirar as tarefas.'));
    },
  });

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const ids = (data?.results ?? [])
      .filter((t) => t.status === 'error' || t.status === 'completed')
      .map((t) => t.id);
    setSelected((prev) => {
      if (prev.size === ids.length && ids.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(ids);
    });
  }

  const selectableIds = (data?.results ?? [])
    .filter((t) => t.status === 'error' || t.status === 'completed')
    .map((t) => t.id);
  const allSelectableChecked =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const columns: Column<RpaDispatchTask>[] = [
    {
      key: '__select',
      header: (
        <input
          type="checkbox"
          checked={allSelectableChecked}
          onChange={toggleSelectAll}
          aria-label="Selecionar tudo"
        />
      ),
      width: '40px',
      render: (row) => {
        const disabled = row.status !== 'error' && row.status !== 'completed';
        return (
          <input
            type="checkbox"
            disabled={disabled}
            checked={selected.has(row.id)}
            onChange={() => toggleSelected(row.id)}
            aria-label={`Selecionar ${row.id}`}
          />
        );
      },
    },
    {
      key: 'task_type',
      header: 'Tipo',
      render: (row) => row.task_type_display,
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row) => (
        <Badge variant={STATUS_BADGE[row.status]}>{row.status_display}</Badge>
      ),
    },
    {
      key: 'related',
      header: 'Objeto',
      render: (row) =>
        row.related_object_type_display
          ? `${row.related_object_type_display}`
          : '-',
    },
    {
      key: 'external_reference',
      header: 'Referência',
      render: (row) => row.external_reference || '-',
    },
    {
      key: 'retry_count',
      header: 'Tentativas',
      width: '100px',
      render: (row) => row.retry_count,
    },
    {
      key: 'last_attempt_at',
      header: 'Última tentativa',
      width: '160px',
      render: (row) => formatDateTime(row.last_attempt_at),
    },
    {
      key: 'created_at',
      header: 'Criado em',
      width: '160px',
      render: (row) => formatDateTime(row.created_at),
    },
    {
      key: 'actions',
      header: '',
      width: '180px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDetailTask(row)}
            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50"
          >
            Detalhes
          </button>
          {(row.status === 'error' || row.status === 'completed') && (
            <button
              type="button"
              onClick={() => requeueMutation.mutate(row.id)}
              disabled={requeueMutation.isPending}
              className="px-2 py-1 text-xs rounded border border-brand-blue text-brand-blue hover:bg-brand-blue/5 inline-flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" />
              Reenviar
            </button>
          )}
        </div>
      ),
    },
  ];

  const selectedErrorCount = (data?.results ?? []).filter(
    (t) => selected.has(t.id) && t.status === 'error',
  ).length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Reprocessamento RPA
          </h1>
          <p className="mt-1 text-sm text-text-tertiary">
            Acompanhe disparos enfileirados para o RPA (instruções fiscais, chamados Desk Manager) e reenfileire tarefas com erro.
          </p>
          {selectedErrorCount > 0 && (
            <p className="mt-1 text-xs text-warning">
              {selectedErrorCount} tarefa(s) com erro selecionada(s).
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm inline-flex items-center gap-2 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <ButtonPrimary
            icon={RotateCw}
            onClick={() => bulkRequeueMutation.mutate(Array.from(selected))}
            disabled={selected.size === 0 || bulkRequeueMutation.isPending}
          >
            Reenviar selecionadas
          </ButtonPrimary>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={STATUS_OPTIONS.find((o) => o.value === statusFilter) ?? null}
          onChange={(opt) => {
            const v = (opt as { value: RpaTaskStatus | '' } | null)?.value ?? '';
            setStatusFilter(v);
            setPage(1);
          }}
        />
        <Select
          label="Tipo"
          options={TYPE_OPTIONS}
          value={TYPE_OPTIONS.find((o) => o.value === typeFilter) ?? null}
          onChange={(opt) => {
            const v = (opt as { value: RpaTaskType | '' } | null)?.value ?? '';
            setTypeFilter(v);
            setPage(1);
          }}
        />
      </div>

      <DataTable<RpaDispatchTask>
        columns={columns}
        data={data?.results ?? []}
        totalItems={data?.count ?? 0}
        currentPage={page}
        pagination={{
          enabled: true,
          pageSize,
          onPageChange: (p) => setPage(p),
          onPageSizeChange: (s) => setPageSize(s),
        }}
      />
      {isLoading && (
        <div className="p-4 text-center text-sm text-text-tertiary">Carregando…</div>
      )}

      <Modal
        isOpen={!!detailTask}
        onClose={() => setDetailTask(null)}
        title="Detalhes da tarefa"
        closeOnEscape
      >
        {detailTask && (
          <div className="p-6 space-y-3 max-h-[80vh] overflow-y-auto text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-text-tertiary">Tipo</div>
                <div>{detailTask.task_type_display}</div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary">Status</div>
                <Badge variant={STATUS_BADGE[detailTask.status]}>
                  {detailTask.status_display}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-text-tertiary">Tentativas</div>
                <div>{detailTask.retry_count}</div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary">Referência externa</div>
                <div>{detailTask.external_reference || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary">Objeto relacionado</div>
                <div>
                  {detailTask.related_object_type_display || '-'}
                  {detailTask.related_object_id
                    ? ` · ${detailTask.related_object_id}`
                    : ''}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary">Criado em</div>
                <div>{formatDateTime(detailTask.created_at)}</div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary">Última tentativa</div>
                <div>{formatDateTime(detailTask.last_attempt_at)}</div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary">Concluído em</div>
                <div>{formatDateTime(detailTask.completed_at)}</div>
              </div>
            </div>

            {detailTask.error_message && (
              <div>
                <div className="text-xs text-text-tertiary mb-1">Mensagem de erro</div>
                <pre className="rounded-md bg-error-light text-error p-3 text-xs whitespace-pre-wrap break-all">
                  {detailTask.error_message}
                </pre>
              </div>
            )}

            <div>
              <div className="text-xs text-text-tertiary mb-1">Payload</div>
              <pre className="rounded-md bg-slate-50 p-3 text-xs whitespace-pre-wrap break-all">
                {JSON.stringify(detailTask.payload, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {(detailTask.status === 'error' ||
                detailTask.status === 'completed') && (
                <ButtonPrimary
                  icon={RotateCw}
                  onClick={() => {
                    requeueMutation.mutate(detailTask.id);
                    setDetailTask(null);
                  }}
                  disabled={requeueMutation.isPending}
                >
                  Reenviar
                </ButtonPrimary>
              )}
              <button
                type="button"
                onClick={() => setDetailTask(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
