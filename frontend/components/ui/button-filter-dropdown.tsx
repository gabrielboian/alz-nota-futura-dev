import React from 'react';
import { ChevronDown } from 'lucide-react';

interface ButtonFilterDropdownProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Filter button with chevron-down icon on the right (dropdown indicator)
 * Figma Node ID: 44:12354
 */
export function ButtonFilterDropdown({
  children = 'Filtro',
  className = '',
  ...props
}: ButtonFilterDropdownProps) {
  return (
    <button
      className={`bg-white border border-border-default flex gap-2 items-center justify-center px-3 py-1 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${className}`}
      data-component="button-filter-dropdown"
      {...props}
    >
      <span className="font-normal text-sm text-text-secondary">{children}</span>
      <ChevronDown className="w-5 h-5 text-text-secondary" />
    </button>
  );
}
