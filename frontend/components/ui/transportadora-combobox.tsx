'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { lookupsApi, type FreightAgent } from '@/lib/api/lookups';
import { getErrorMessage } from '@/lib/errors';

interface TransportadoraComboboxProps {
  /** Stores the transportadora code (not the id). */
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
}

/**
 * Searchable combobox over `/lookups/freight-agents/`.
 * Returns both third-party transportadoras and ALZ transport subsidiaries (ALZT).
 * Selecting fills `value` with the agent's SAP code.
 * Allows creating a new third-party transportadora on-the-fly (CPT flow).
 */
export function TransportadoraCombobox({
  value,
  onChange,
  disabled,
  error,
  placeholder = 'Buscar ou digitar código da transportadora…',
}: TransportadoraComboboxProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newState, setNewState] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRawSearch(value);
  }, [value]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(rawSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [rawSearch]);

  useEffect(() => {
    function handleClick(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const query = useQuery({
    queryKey: ['lookup-freight-agents', debouncedSearch],
    queryFn: () => lookupsApi.freightAgents(debouncedSearch || undefined),
    enabled: open && !disabled,
  });

  const items = query.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      lookupsApi.createTransportadora({ code: newCode.trim(), name: newName.trim(), state: newState.trim() }),
    onSuccess: (created) => {
      onChange(created.code);
      setRawSearch(created.code);
      setOpen(false);
      setShowCreate(false);
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ['lookup-freight-agents'] });
    },
    onError: (err) => {
      setCreateError(getErrorMessage(err, 'Não foi possível criar a transportadora.'));
    },
  });

  const trimmedSearch = rawSearch.trim();
  const hasExactMatch = items.some(
    (t: FreightAgent) =>
      t.code.toLowerCase() === trimmedSearch.toLowerCase() ||
      t.name.toLowerCase() === trimmedSearch.toLowerCase(),
  );
  const canCreate = open && !disabled && trimmedSearch.length > 0 && !hasExactMatch && !query.isLoading;

  function handleSelect(t: FreightAgent) {
    onChange(t.code);
    setRawSearch(t.code);
    setOpen(false);
    setShowCreate(false);
    setCreateError(null);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={rawSearch}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setRawSearch(e.target.value);
          onChange(e.target.value);
          setOpen(true);
          setCreateError(null);
          setShowCreate(false);
        }}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-text-tertiary ${
          error
            ? 'border-error focus:ring-error'
            : 'border-slate-300 focus:ring-primary'
        }`}
      />

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {query.isLoading && (
            <div className="px-3 py-2 text-sm text-text-tertiary">Carregando…</div>
          )}
          {!query.isLoading && items.length === 0 && trimmedSearch.length === 0 && (
            <div className="px-3 py-2 text-sm text-text-tertiary">
              Digite para buscar transportadoras.
            </div>
          )}
          {items.map((t) => (
            <button
              key={t.code}
              type="button"
              onClick={() => handleSelect(t)}
              className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
            >
              <div className="font-medium text-text-primary">
                {t.code} — {t.name}
              </div>
              {t.state && (
                <div className="text-xs text-text-tertiary">{t.state}</div>
              )}
            </button>
          ))}

          {canCreate && !showCreate && (
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
                setNewCode(trimmedSearch);
                setNewName('');
                setNewState('');
              }}
              className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-brand-blue hover:bg-slate-50"
            >
              + Cadastrar nova transportadora "{trimmedSearch}"
            </button>
          )}

          {showCreate && (
            <div className="border-t border-slate-100 p-3 space-y-2">
              <p className="text-xs font-medium text-text-primary">Nova transportadora</p>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Código SAP"
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome"
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none"
              />
              <input
                type="text"
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                placeholder="UF (opcional)"
                maxLength={2}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none"
              />
              {createError && (
                <p className="text-xs text-error">{createError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !newCode.trim() || !newName.trim()}
                  className="flex-1 rounded bg-brand-blue px-2 py-1 text-xs text-white disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs text-text-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
