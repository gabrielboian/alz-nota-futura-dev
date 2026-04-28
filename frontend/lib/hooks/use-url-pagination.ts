'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type UrlPaginationOptions = {
  /** Default page when `?page=` is missing or invalid. */
  defaultPage?: number;
  /** Default page size when `?page_size=` is missing or invalid. */
  defaultPageSize?: number;
  /** Allowed page size values. Out-of-range values fall back to `defaultPageSize`. */
  pageSizeOptions?: number[];
};

export type UrlPaginationState = {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
};

/**
 * Syncs pagination state with the URL query string.
 *
 * Users can navigate directly to a specific page by typing the URL,
 * e.g. `/contracts?page=34` or `/contracts?page=5&page_size=50`.
 *
 * The URL is updated via `router.replace` (no history entry per click)
 * and uses `scroll: false` so the page doesn't jump on navigation.
 */
export function useUrlPagination(options: UrlPaginationOptions = {}): UrlPaginationState {
  const { defaultPage = 1, defaultPageSize = 20, pageSizeOptions } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = useMemo(() => {
    const raw = searchParams.get('page');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : defaultPage;
  }, [searchParams, defaultPage]);

  const pageSize = useMemo(() => {
    const raw = searchParams.get('page_size');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(parsed) || parsed < 1) return defaultPageSize;
    if (pageSizeOptions && !pageSizeOptions.includes(parsed)) return defaultPageSize;
    return parsed;
  }, [searchParams, defaultPageSize, pageSizeOptions]);

  const writeParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || value === undefined) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      writeParams({ page: nextPage === defaultPage ? null : nextPage });
    },
    [writeParams, defaultPage],
  );

  const setPageSize = useCallback(
    (nextSize: number) => {
      writeParams({
        page_size: nextSize === defaultPageSize ? null : nextSize,
        page: null,
      });
    },
    [writeParams, defaultPageSize],
  );

  return { page, pageSize, setPage, setPageSize };
}
