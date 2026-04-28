import React from 'react';

export type BadgeVariant = 'default' | 'special' | 'info' | 'success' | 'warning' | 'error';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-slate-50 text-text-primary',
    special: 'bg-special-50 text-text-primary',
    info: 'bg-info-light text-info',
    success: 'bg-success-light text-success',
    warning: 'bg-warning-light text-warning',
    error: 'bg-error-light text-error',
  };

  return (
    <div
      className={`min-h-7 px-3 py-1 rounded-full inline-flex justify-center items-center gap-2 whitespace-nowrap ${variants[variant]} ${className}`}
    >
      <span className="text-center text-sm font-medium font-['Inter'] leading-5">
        {children}
      </span>
    </div>
  );
}
