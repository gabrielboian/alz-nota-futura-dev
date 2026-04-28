'use client';

import React, { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

/**
 * Input component with consistent styling
 *
 * @example
 * <Input placeholder="Digite a placa" />
 * <Input label="Nome" placeholder="Digite seu nome" />
 * <Input error="Campo obrigatório" placeholder="Email" />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            {label}
          </label>
        )}
        <div
          className={`h-10 px-3 py-2 bg-white rounded-lg outline-1 -outline-offset-1 inline-flex justify-start items-center gap-2.5 w-full transition-colors ${
            error
              ? 'outline-error focus-within:outline-error'
              : 'outline-border-default focus-within:outline-border-focus'
          } ${className}`}
        >
          <input
            ref={ref}
            className="flex-1 h-6 bg-transparent text-text-primary text-sm font-normal font-['Inter'] leading-5 outline-none placeholder:text-text-tertiary"
            {...props}
          />
          {icon && <div className="text-text-tertiary shrink-0">{icon}</div>}
        </div>
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
