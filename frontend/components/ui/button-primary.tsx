import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonPrimaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

/**
 * Primary action button with optional icon on the left
 * Figma Node ID: 3:3129
 */
export function ButtonPrimary({
  children,
  icon: Icon,
  className = '',
  ...props
}: ButtonPrimaryProps) {
  return (
    <button
      className={`bg-brand-blue flex gap-2 items-center justify-center px-3 py-2 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${className}`}
      data-component="button-primary"
      {...props}
    >
      {Icon && <Icon className="w-5 h-5 text-white" />}
      <span className="font-bold text-sm text-white">{children}</span>
    </button>
  );
}
