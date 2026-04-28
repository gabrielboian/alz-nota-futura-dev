'use client';

import React from 'react';

interface RadioOption {
  value: string;
  label: string;
}

interface RadioProps {
  label?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  error?: string;
  className?: string;
}

/**
 * Radio component with consistent styling
 *
 * @example
 * <Radio
 *   label="É caminhão Truck?"
 *   name="truck"
 *   options={[
 *     { value: 'yes', label: 'Sim' },
 *     { value: 'no', label: 'Não' }
 *   ]}
 *   value={value}
 *   onChange={setValue}
 * />
 */
export function Radio({
  label,
  options,
  value,
  onChange,
  name,
  error,
  className = '',
}: RadioProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-normal text-slate-900 mb-2">
          {label}
        </label>
      )}
      <div className="flex items-center gap-6">
        {options.map((option) => {
          const isChecked = value === option.value;
          return (
            <label
              key={option.value}
              className="flex items-center gap-1 cursor-pointer"
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isChecked}
                onChange={(e) => onChange(e.target.value)}
                className="sr-only"
              />
              <div className="w-5 h-5 relative flex items-center justify-center">
                <div className={`w-4 h-4 border-2 rounded-full flex items-center justify-center transition-all ${isChecked ? 'border-[#184367] bg-white' : 'border-gray-300 bg-white'}`}>
                  {isChecked && (
                    <div className="w-2 h-2 rounded-full bg-[#184367]" />
                  )}
                </div>
              </div>
              <span className="text-sm font-normal text-slate-900">
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
