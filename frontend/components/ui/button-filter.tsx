import React from 'react';
import { Filter } from 'lucide-react';

interface ButtonFilterProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Filter button with filter icon on the left
 * Figma Node ID: 3:3126
 */
export function ButtonFilter({
  children = 'Filtro',
  className = '',
  ...props
}: ButtonFilterProps) {
  return (
    <button
      className={`bg-white border border-border-default flex gap-2 items-center justify-center px-3 py-1 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${className}`}
      data-component="button-filter"
      {...props}
    >
      <Filter className="w-5 h-5 text-brand-blue" />
      <span className="font-bold text-sm text-brand-blue">{children}</span>
    </button>
  );
}
