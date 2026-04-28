/**
 * Table Skeleton Component
 * 
 * Loading state for tables matching the column-based design pattern.
 */

interface TableSkeletonProps {
    columns?: number;
    rows?: number;
  }
  
  export function TableSkeleton({ columns = 11, rows = 5 }: TableSkeletonProps) {
    return (
      <div className="w-full bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-gray-200 inline-flex flex-col justify-center items-start overflow-hidden">
        {/* Table Header + Body - Horizontal Scroll Container */}
        <div className="w-full overflow-x-auto">
          <div className="inline-flex justify-start items-start min-w-full">
            {/* Render skeleton columns */}
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="w-40 inline-flex flex-col justify-start items-start overflow-hidden"
              >
                {/* Column Header Skeleton */}
                <div className="w-full h-11 p-3 border-b border-gray-200 inline-flex justify-start items-center gap-2">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                </div>
  
                {/* Column Body Cells Skeleton */}
                {Array.from({ length: rows }).map((_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="w-full h-11 p-3 border-b border-gray-200 inline-flex justify-start items-center gap-2"
                  >
                    <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
  
        {/* Scroll Progress Bar */}
        <div className="self-stretch px-3 py-1 bg-white border-b border-gray-200 flex flex-col justify-center items-start gap-2.5">
          <div className="w-96 h-2 bg-zinc-200 rounded-xl" />
        </div>
  
        {/* Footer Pagination Skeleton */}
        <div className="self-stretch px-5 py-3 bg-white border-t border-gray-200 inline-flex justify-between items-center gap-5">
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
          
          <div className="flex items-center gap-2">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          </div>
  
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-12 animate-pulse" />
            <div className="h-6 w-6 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }
  