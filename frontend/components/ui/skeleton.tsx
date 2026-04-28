import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'pulse' | 'wave';
}

/**
 * Base Skeleton component for loading states
 *
 * @example
 * <Skeleton className="h-4 w-full" />
 * <Skeleton className="h-12 w-12 rounded-full" variant="pulse" />
 */
export function Skeleton({ className, variant = 'pulse' }: SkeletonProps) {
  const variantClasses = {
    default: '',
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200',
  };

  return (
    <div
      className={cn(
        'bg-slate-200 rounded',
        variantClasses[variant],
        className
      )}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/**
 * Skeleton for text content with multiple lines
 *
 * @example
 * <SkeletonText lines={3} />
 */
export function SkeletonText({ lines = 1, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-4/5' : 'w-full' // Last line is shorter
          )}
        />
      ))}
    </div>
  );
}

interface SkeletonCircleProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Circular skeleton (for avatars, icons, etc.)
 *
 * @example
 * <SkeletonCircle size="lg" />
 */
export function SkeletonCircle({ size = 'md', className }: SkeletonCircleProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24',
  };

  return (
    <Skeleton
      className={cn('rounded-full', sizeClasses[size], className)}
    />
  );
}
