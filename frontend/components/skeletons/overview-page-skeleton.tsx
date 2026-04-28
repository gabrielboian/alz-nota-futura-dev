import { StatsCardSkeleton } from './stats-card-skeleton';
import { TableSkeleton } from './table-skeleton';
import { ChartSkeleton } from './chart-skeleton';

/**
 * Skeleton for the Overview page
 * Shows loading state for stats cards, table, and chart
 */
export function OverviewPageSkeleton() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
      </div>

      {/* Stats Cards - 6 cards (3 for Milho, 3 for Soja) */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Vehicles Table */}
        <div className="col-span-2">
          <TableSkeleton
            rows={5}
            columns={5}
            title="Veículos em trânsito"
          />
        </div>

        {/* Chart */}
        <ChartSkeleton
          title="Monitoramento de veículos"
          height={300}
        />
      </div>
    </div>
  );
}
