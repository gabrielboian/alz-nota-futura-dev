import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${className}`}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: TableProps) {
  return <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>;
}

export function TableBody({ children }: TableProps) {
  return <tbody className="divide-y divide-slate-200">{children}</tbody>;
}

export function TableRow({ children, className = '' }: TableProps) {
  return <tr className={className}>{children}</tr>;
}

export function TableHead({ children, className = '' }: TableProps) {
  return (
    <th className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '' }: TableProps) {
  return <td className={`px-6 py-4 text-sm text-slate-900 ${className}`}>{children}</td>;
}
