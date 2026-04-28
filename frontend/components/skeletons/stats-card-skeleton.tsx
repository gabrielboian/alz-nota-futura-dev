import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonCircle } from '@/components/ui/skeleton';

/**
 * Skeleton for StatsCard component
 * Used while loading dashboard statistics
 */
export function StatsCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            {/* Title */}
            <Skeleton className="h-4 w-32" />

            {/* Value */}
            <Skeleton className="h-8 w-20" />

            {/* Subtitle */}
            <Skeleton className="h-3 w-16" />
          </div>

          {/* Icon */}
          <div className="shrink-0">
            <SkeletonCircle size="md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
