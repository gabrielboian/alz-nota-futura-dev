'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { lookupsApi, type Producer } from '@/lib/api/lookups';
import { getErrorMessage } from '@/lib/errors';

interface ProducerComboboxProps {
  /** Free-text value (the producer name). */
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Searchable combobox over `/lookups/producers/` with infinite scroll.
 *
 * - Selecting an existing producer fills `value` with its name.
 * - Typing a name not in the list shows a "Criar produtor" action that POSTs
 *   to the registry and selects the newly created producer.
 */
export function ProducerCombobox({
  value,
  onChange,
  disabled,
  error,
  placeholder = 'Buscar ou digitar nome do produtor…',
  pageSize = DEFAULT_PAGE_SIZE,
}: ProducerComboboxProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Sync the input text whenever the parent value changes.
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

  const query = useInfiniteQuery({
    queryKey: ['lookup-producers', debouncedSearch, pageSize],
    initialPageParam: 1,
    enabled: open && !disabled,
    queryFn: ({ pageParam }) =>
      lookupsApi.listProducers({
        page: pageParam as number,
        page_size: pageSize,
        search: debouncedSearch || undefined,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.next ? allPages.length + 1 : undefined,
  });

  const items = useMemo<Producer[]>(
    () => query.data?.pages.flatMap((p) => p.results) ?? [],
    [query.data],
  );

  useEffect(() => {
    if (!open || !sentinelRef.current) return;
    const sentinel = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          query.hasNextPage &&
          !query.isFetchingNextPage
        ) {
          query.fetchNextPage();
        }
      },
      { root: listRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, query]);

  const createMutation = useMutation({
    mutationFn: (name: string) => lookupsApi.createProducer(name),
    onSuccess: (created) => {
      onChange(created.name);
      setRawSearch(created.name);
      setOpen(false);
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ['lookup-producers'] });
    },
    onError: (err) => {
      setCreateError(getErrorMessage(err, 'Não foi possível criar o produtor.'));
    },
  });

  const trimmedSearch = rawSearch.trim();
  const hasExactMatch = items.some(
    (p) => p.name.trim().toLowerCase() === trimmedSearch.toLowerCase(),
  );
  const canCreate =
    open && !disabled && trimmedSearch.length > 0 && !hasExactMatch && !query.isLoading;

  function handleSelect(producer: Producer) {
    onChange(producer.name);
    setRawSearch(producer.name);
    setOpen(false);
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
        }}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-text-tertiary ${
          error
            ? 'border-error focus:ring-error'
            : 'border-slate-300 focus:ring-primary'
        }`}
      />

      {open && !disabled && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
        >
          {query.isLoading && (
            <div className="px-3 py-2 text-sm text-text-tertiary">Carregando…</div>
          )}
          {!query.isLoading && items.length === 0 && trimmedSearch.length === 0 && (
            <div className="px-3 py-2 text-sm text-text-tertiary">
              Digite para buscar produtores.
            </div>
          )}
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
            >
              <div className="font-medium text-text-primary">{p.name}</div>
              {p.cpf_cnpj && (
                <div className="truncate text-xs text-text-tertiary">{p.cpf_cnpj}</div>
              )}
            </button>
          ))}
          <div ref={sentinelRef} />
          {query.isFetchingNextPage && (
            <div className="px-3 py-2 text-xs text-text-tertiary">Carregando mais…</div>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={() => createMutation.mutate(trimmedSearch)}
              disabled={createMutation.isPending}
              className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-brand-blue hover:bg-slate-50 disabled:opacity-50"
            >
              {createMutation.isPending
                ? 'Criando…'
                : `+ Cadastrar novo produtor "${trimmedSearch}"`}
            </button>
          )}
          {createError && (
            <div className="border-t border-slate-100 px-3 py-2 text-xs text-error">
              {createError}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
