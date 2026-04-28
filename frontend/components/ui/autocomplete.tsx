'use client';

import React, { useState, useEffect, useRef } from 'react';

interface AutocompleteOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface AutocompleteProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => Promise<AutocompleteOption[]>;
  onBlur?: () => void;
  error?: string;
  maxLength?: number;
  className?: string;
  debounceMs?: number;
}

/**
 * Autocomplete input component with search suggestions
 *
 * @example
 * <Autocomplete
 *   label="Placa"
 *   placeholder="ABC1234"
 *   value={plate}
 *   onChange={setPlate}
 *   onSearch={async (query) => {
 *     const results = await vehiclesApi.list({ search: query });
 *     return results.results.map(v => ({ value: v.plate, label: v.plate }));
 *   }}
 * />
 */
export function Autocomplete({
  label,
  placeholder,
  value,
  onChange,
  onSearch,
  onBlur,
  error,
  maxLength,
  className = '',
  debounceMs = 300,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>(null);
  // Suppress the search-effect that fires right after the user picks an option
  const justSelectedRef = useRef(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for options when value changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Value was just set by a selection — don't re-search
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (value.length >= 2) {
      debounceTimerRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const results = await onSearch(value);
          setOptions(results);
          setIsOpen(results.length > 0);
        } catch (error) {
          console.error('Error searching:', error);
          setOptions([]);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs);
    } else {
      setOptions([]);
      setIsOpen(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, onSearch, debounceMs]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);
    setSelectedIndex(-1);
  }

  function handleOptionClick(option: AutocompleteOption) {
    justSelectedRef.current = true;
    onChange(option.value);
    setIsOpen(false);
    setSelectedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || options.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < options.length) {
          handleOptionClick(options[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (options.length > 0) setIsOpen(true);
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full h-10 px-3 py-2 bg-white rounded-lg border transition-colors
            ${error 
              ? 'border-error focus:border-error' 
              : 'border-border-default focus:border-brand-blue'
            }
            text-sm text-text-primary placeholder:text-text-placeholder
            focus:outline-none focus:ring-0
          `}
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-brand-blue rounded-full animate-spin" />
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-error">{error}</p>}

      {/* Dropdown */}
      {isOpen && options.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-border-default shadow-lg max-h-60 overflow-y-auto">
          {options.map((option, index) => (
            <div
              key={option.value}
              onMouseDown={(e) => { e.preventDefault(); handleOptionClick(option); }}
              className={`px-3 py-2 cursor-pointer transition-colors
                ${index === selectedIndex 
                  ? 'bg-background-secondary' 
                  : 'hover:bg-background-secondary'
                }
              `}
            >
              <div className="text-sm font-medium text-text-primary">
                {option.label}
              </div>
              {option.subtitle && (
                <div className="text-xs text-text-tertiary mt-0.5">
                  {option.subtitle}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
