'use client';

import React from 'react';
import ReactSelect, {
  Props as ReactSelectProps,
  GroupBase,
  StylesConfig,
} from 'react-select';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps<
  Option = SelectOption,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
> extends Omit<ReactSelectProps<Option, IsMulti, Group>, 'styles'> {
  label?: string;
  error?: string;
}

/**
 * Select component using react-select with custom styling
 *
 * @example
 * const options = [
 *   { value: 'option1', label: 'Option 1' },
 *   { value: 'option2', label: 'Option 2' },
 * ];
 *
 * <Select
 *   options={options}
 *   placeholder="Selecione uma opção"
 *   onChange={(option) => console.log(option)}
 * />
 *
 * <Select
 *   label="Estado"
 *   options={options}
 *   error="Campo obrigatório"
 * />
 */
export function Select<
  Option = SelectOption,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>
>({ label, error, ...props }: SelectProps<Option, IsMulti, Group>) {
  const isMulti = props.isMulti;
  const customStyles: StylesConfig<Option, IsMulti, Group> = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '40px',
      ...(isMulti ? { height: '40px', overflow: 'hidden' } : { height: '40px' }),
      borderRadius: '8px',
      borderColor: error
        ? 'var(--error)'
        : state.isFocused
        ? 'var(--border-focus)'
        : 'var(--border-default)',
      borderWidth: '1px',
      boxShadow: 'none',
      backgroundColor: 'var(--background)',
      outline: 'none',
      outlineOffset: '-1px',
      cursor: 'pointer',
      '&:hover': {
        borderColor: error
          ? 'var(--error)'
          : state.isFocused
          ? 'var(--border-focus)'
          : 'var(--border-default)',
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      minHeight: '40px',
      ...(isMulti ? { padding: '4px 12px', flexWrap: 'nowrap' as const, overflow: 'auto' } : { height: '40px', padding: '0 12px' }),
    }),
    input: (provided) => ({
      ...provided,
      margin: '0',
      padding: '0',
      color: 'var(--text-primary)',
      fontSize: '14px',
      fontFamily: 'Inter',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--text-tertiary)',
      fontSize: '14px',
      fontFamily: 'Inter',
      textTransform: 'uppercase' as const,
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'var(--text-primary)',
      fontSize: '14px',
      fontFamily: 'Inter',
      textTransform: 'uppercase' as const,
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      color: 'var(--text-tertiary)',
      padding: '8px',
      '&:hover': {
        color: 'var(--text-secondary)',
      },
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: '8px',
      marginTop: '4px',
      boxShadow: '0px 4px 8px 0px rgba(0,0,0,0.09)',
      border: '1px solid var(--border-default)',
      overflow: 'hidden',
    }),
    menuList: (provided) => ({
      ...provided,
      padding: '4px',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? 'var(--brand-blue)'
        : state.isFocused
        ? 'var(--background-secondary)'
        : 'transparent',
      color: state.isSelected ? 'white' : 'var(--text-primary)',
      fontSize: '14px',
      fontFamily: 'Inter',
      padding: '8px 12px',
      borderRadius: '6px',
      cursor: 'pointer',
      textTransform: 'uppercase' as const,
      '&:active': {
        backgroundColor: state.isSelected
          ? 'var(--brand-blue)'
          : 'var(--background-secondary)',
      },
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: 'var(--background-secondary)',
      borderRadius: '4px',
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: 'var(--text-primary)',
      fontSize: '14px',
      fontFamily: 'Inter',
      textTransform: 'uppercase' as const,
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: 'var(--text-tertiary)',
      ':hover': {
        backgroundColor: 'var(--error-light)',
        color: 'var(--error)',
      },
    }),
    // Render the menu dropdown above every element by attaching to document.body
    menuPortal: (provided) => ({
      ...provided,
      zIndex: 99999,
    }),
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          {label}
        </label>
      )}
      <ReactSelect<Option, IsMulti, Group>
        styles={customStyles}
        menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
        menuPosition="fixed"
        {...props}
      />
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
