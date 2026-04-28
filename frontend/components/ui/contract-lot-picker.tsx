'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { contractsApi, type ContractBaseLot } from '@/lib/api/contracts';

interface ContractLotPickerProps {
  label?: string;
  value: ContractBaseLot | null;
  onChange: (lot: ContractBaseLot | null) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Searchable combobox over `/contracts/base-lots/` with infinite scroll.
 * Shows the lot number, producer and product. The selected value is
 * the full `ContractBaseLot` object — the caller picks the fields it needs.
 */
export function ContractLotPicker({
  label = 'Nº do Contrato',
  value,
  onChange,
  error,
  disabled,
  placeholder = 'Buscar por lote, produtor, CPF/CNPJ ou produto…',
  pageSize = DEFAULT_PAGE_SIZE,
}: ContractLotPickerProps) {
  const [open, setOpen] = useState(false);
  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

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
    queryKey: ['contract-base-lots', debouncedSearch, pageSize],
    initialPageParam: 1,
    enabled: open,
    queryFn: ({ pageParam }) =>
      contractsApi.listBaseLots({
        page: pageParam as number,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        ordering: 'lot_number',
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.next ? allPages.length + 1 : undefined,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.results) ?? [],
    [query.data],
  );

  // Infinite-scroll sentinel.
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

  function handleSelect(lot: ContractBaseLot) {
    onChange(lot);
    setOpen(false);
    setRawSearch('');
  }

  function handleClear() {
    onChange(null);
    setRawSearch('');
  }

  const displayLabel = value
    ? `${value.lot_number}${value.producer_name ? ` — ${value.producer_name}` : ''}`
    : '';

  return (
    <div ref={rootRef} className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-text-primary">
          {label}
        </label>
      )}

      {value && !open ? (
        <div className="flex items-center gap-2">
          <div
            className={`flex-1 rounded-md border px-3 py-2 text-sm ${
              error ? 'border-error' : 'border-slate-300'
            } bg-white`}
          >
            <div className="font-medium text-text-primary">{value.lot_number}</div>
            <div className="text-xs text-text-tertiary">
              {[value.producer_name, value.product].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-text-tertiary hover:text-text-primary"
            >
              Trocar
            </button>
          )}
        </div>
      ) : (
        <input
          type="text"
          value={rawSearch}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setRawSearch(e.target.value);
            setOpen(true);
          }}
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            error
              ? 'border-error focus:ring-error'
              : 'border-slate-300 focus:ring-primary'
          }`}
        />
      )}

      {open && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
        >
          {query.isLoading && (
            <div className="px-3 py-2 text-sm text-text-tertiary">Carregando…</div>
          )}
          {!query.isLoading && items.length === 0 && (
            <div className="px-3 py-2 text-sm text-text-tertiary">
              Nenhum contrato encontrado.
            </div>
          )}
          {items.map((lot) => (
            <button
              key={lot.id}
              type="button"
              onClick={() => handleSelect(lot)}
              className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                value?.id === lot.id ? 'bg-slate-100' : ''
              }`}
            >
              <div className="font-medium text-text-primary">{lot.lot_number}</div>
              <div className="truncate text-xs text-text-tertiary">
                {[lot.producer_name, lot.product, lot.cpf_cnpj]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>
            </button>
          ))}
          <div ref={sentinelRef} />
          {query.isFetchingNextPage && (
            <div className="px-3 py-2 text-xs text-text-tertiary">Carregando mais…</div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-error">{error}</p>}

      {value && (
        <p className="mt-1 text-xs text-text-tertiary">
          {value.product ? `Produto: ${value.product} · ` : ''}
          Qtd contratada:{' '}
          {Number(value.quantity_kg || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          })}{' '}
          kg
        </p>
      )}
    </div>
  );
}
