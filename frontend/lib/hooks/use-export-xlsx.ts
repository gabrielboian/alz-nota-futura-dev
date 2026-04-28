import { useState, useCallback } from 'react';
import { exportToXlsx, ExportColumn } from '@/lib/utils/export-xlsx';

interface PaginatedResponse<T> {
  count: number;
  results: T[];
  next?: string | null;
}

interface UseExportXlsxOptions<T> {
  /** Function that fetches one page. page and page_size will be injected. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchFn: (params: any) => Promise<PaginatedResponse<T>>;
  /** Base params (filters, status, etc.) that will be merged with page/page_size. */
  baseParams: Record<string, any>;
  columns: ExportColumn<T>[];
  filename: string;
}

const EXPORT_PAGE_SIZE = 100;

/**
 * Hook that fetches ALL pages of a paginated endpoint and exports the result
 * as an XLSX file. Respects the current filters via baseParams.
 *
 * Usage:
 *   const { downloadXlsx, isDownloading } = useExportXlsx({ fetchFn, baseParams, columns, filename });
 *   <button onClick={downloadXlsx} disabled={isDownloading}> ... </button>
 */
export function useExportXlsx<T>({
  fetchFn,
  baseParams,
  columns,
  filename,
}: UseExportXlsxOptions<T>) {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadXlsx = useCallback(async () => {
    setIsDownloading(true);
    try {
      // Fetch first page to get total count
      const firstPage = await fetchFn({
        ...baseParams,
        page: 1,
        page_size: EXPORT_PAGE_SIZE,
      });

      const total = firstPage.count;
      const allResults: T[] = [...firstPage.results];

      if (total > EXPORT_PAGE_SIZE) {
        const totalPages = Math.ceil(total / EXPORT_PAGE_SIZE);
        // Fetch remaining pages in parallel batches of 5
        for (let batchStart = 2; batchStart <= totalPages; batchStart += 5) {
          const batchEnd = Math.min(batchStart + 4, totalPages);
          const pageNums = Array.from(
            { length: batchEnd - batchStart + 1 },
            (_, i) => batchStart + i,
          );
          const pages = await Promise.all(
            pageNums.map((p) =>
              fetchFn({ ...baseParams, page: p, page_size: EXPORT_PAGE_SIZE }),
            ),
          );
          pages.forEach((p) => allResults.push(...p.results));
        }
      }

      exportToXlsx(allResults, columns, filename);
    } finally {
      setIsDownloading(false);
    }
  }, [fetchFn, baseParams, columns, filename]);

  return { downloadXlsx, isDownloading };
}
