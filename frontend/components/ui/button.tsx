import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'px-3 py-2 rounded-lg text-sm font-semibold transition-colors w-full inline-flex items-center justify-center gap-2 leading-6';

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover font-bold',
    secondary: 'bg-slate-100 text-text-primary hover:bg-slate-200',
    outline: 'border border-border-default bg-white text-text-primary hover:bg-slate-50',
  };

  return (
    <button
      className={`cursor-pointer ${variants[variant]} ${baseStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
