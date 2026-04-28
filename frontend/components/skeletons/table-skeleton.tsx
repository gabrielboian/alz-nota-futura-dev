import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  title?: string;
}

/**
 * Skeleton for DataTable component
 * Used while loading table data
 *
 * @example
 * <TableSkeleton rows={5} columns={4} title="Veículos em trânsito" />
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  title,
}: TableSkeletonProps) {
  return (
    <Card>
      {showHeader && (
        <CardHeader>
          {title ? (
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          ) : (
            <Skeleton className="h-6 w-48" />
          )}
        </CardHeader>
      )}
      <CardContent>
        {/* Table Header */}
        <div className="border-b border-slate-200 pb-3 mb-3">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
        </div>

        {/* Table Rows */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-4 py-2">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={colIndex} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
