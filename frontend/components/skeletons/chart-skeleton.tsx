import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartSkeletonProps {
  title?: string;
  height?: number;
}

/**
 * Skeleton for chart components
 * Used while loading chart data
 *
 * @example
 * <ChartSkeleton title="Monitoramento de veículos" height={300} />
 */
export function ChartSkeleton({ title, height = 300 }: ChartSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        {title ? (
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        ) : (
          <Skeleton className="h-6 w-48" />
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart area */}
          <div
            className="relative bg-slate-50 rounded-lg"
            style={{ height: `${height}px` }}
          >
            {/* Y-axis */}
            <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-8" />
              ))}
            </div>

            {/* Chart bars/lines placeholder */}
            <div className="absolute left-12 right-0 top-0 bottom-8 flex items-end justify-around px-4 py-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <Skeleton
                    className={`w-full max-w-12 h-[${Math.random() * 60 + 40}%]`}
                  />
                </div>
              ))}
            </div>

            {/* X-axis */}
            <div className="absolute left-12 right-0 bottom-0 h-8 flex justify-around px-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-8" />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
