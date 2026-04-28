'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface MaskedDateFieldProps {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  invalidMessage?: string;
  className?: string;
}

function toDisplayDate(iso: string): string {
  if (!iso || iso.length !== 10) return '';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

function toISODate(display: string): string {
  if (!display || display.length !== 10) return '';
  const [dayPart, monthPart, yearPart] = display.split('/');
  if (!dayPart || !monthPart || !yearPart || yearPart.length !== 4) return '';

  const day = parseInt(dayPart, 10);
  const month = parseInt(monthPart, 10);
  const year = parseInt(yearPart, 10);

  if (month < 1 || month > 12 || day < 1) return '';

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return '';
  }

  return `${yearPart}-${monthPart}-${dayPart}`;
}

export function MaskedDateField({
  label,
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  invalidMessage = 'Data inválida',
  className,
}: MaskedDateFieldProps) {
  const [display, setDisplay] = useState(() => toDisplayDate(value));

  useEffect(() => {
    setDisplay(toDisplayDate(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);

    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    setDisplay(formatted);
    onChange(formatted.length === 10 ? toISODate(formatted) : '');
  }

  const isComplete = display.length === 10;
  const isInvalid = isComplete && !toISODate(display);

  return (
    <Input
      label={label}
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      maxLength={10}
      onChange={handleChange}
      error={isInvalid ? invalidMessage : undefined}
      className={className}
    />
  );
}
