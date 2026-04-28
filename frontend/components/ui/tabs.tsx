'use client';

import React, { useState } from 'react';

interface Tab {
  label: string;
  value: string;
  content?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  /**
   * If true, only renders tab headers without content area.
   * Useful when parent component handles rendering based on active tab.
   */
  headerOnly?: boolean;
  /**
   * Custom className for the tabs container
   */
  className?: string;
}

export function Tabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  headerOnly = false,
  className = ''
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultValue || tabs[0].value);

  // Use controlled value if provided, otherwise use internal state
  const activeTab = value !== undefined ? value : internalActiveTab;

  function handleTabChange(tabValue: string) {
    if (onValueChange) {
      onValueChange(tabValue);
    } else {
      setInternalActiveTab(tabValue);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-col justify-start items-start w-full">
        <div className="inline-flex justify-start items-start">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={`h-12 inline-flex flex-col justify-end items-center overflow-hidden relative ${
                activeTab === tab.value ? 'border-b-2 border-orange-300' : ''
              }`}
            >
              <div className="px-4 py-3.5 flex justify-center items-center">
                <span className={`text-sm font-semibold font-['Inter'] leading-5 ${
                  activeTab === tab.value ? 'text-orange-300' : 'text-slate-900'
                }`}>
                  {tab.label}
                </span>
              </div>
            </button>
          ))}
        </div>
        <div className="self-stretch h-0 outline-1 outline-offset-[-0.50px] outline-gray-200 w-full" />
      </div>
      {!headerOnly && (
        <div className="mt-6">
          {tabs.find((tab) => tab.value === activeTab)?.content}
        </div>
      )}
    </div>
  );
}
