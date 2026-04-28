'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink } from 'lucide-react';

import { fiscalApi, type FiscalInstruction, type PersonType } from '@/lib/api/fiscal';
import { lookupsApi, type Branch } from '@/lib/api/lookups';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/errors';
import { useUrlPagination } from '@/lib/hooks/use-url-pagination';

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

function useQueryParamState(key: string, defaultValue: string = '') {
  if (typeof window === 'undefined') {
    return { value: defaultValue, set: (_v: string) => {} };
  }
  const url = new URL(window.location.href);
  const current = url.searchParams.get(key) ?? defaultValue;
  return {
    value: current,
    set: (v: string) => {
      const next = new URL(window.location.href);
      if (v) next.searchParams.set(key, v);
      else next.searchParams.delete(key);
      window.history.replaceState({}, '', next.toString());
    },
  };
}

export default function FiscalInstructionsPage() {
  const { page, pageSize, setPage, setPageSize } = useUrlPagination();

  const product = useQueryParamState('product');
  const personType = useQueryParamState('person_type');
  const issuerState = useQueryParamState('issuer_state');
  const branch = useQueryParamState('branch');
  const harvestYear = useQueryParamState('harvest_year');

  const { data: branches } = useQuery({
    queryKey: ['lookups', 'branches'],
    queryFn: () => lookupsApi.branches(),
  });

  const branchOptions = useMemo(
    () => [
      { value: '', label: 'Todas as filiais' },
      ...(branches ?? []).map((b: Branch) => ({
        value: b.id,
        label: `${b.sap_code} — ${b.description}`,
      })),
    ],
    [branches],
  );

  const listParams = {
    page,
    page_size: pageSize,
    is_active: true,
    ...(product.value ? { product: product.value } : {}),
    ...(personType.value ? { person_type: personType.value as PersonType } : {}),
    ...(issuerState.value ? { issuer_state: issuerState.value } : {}),
    ...(branch.value ? { branch: branch.value } : {}),
    ...(harvestYear.value ? { harvest_year: harvestYear.value } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['fiscal-instructions', listParams],
    queryFn: () => fiscalApi.list(listParams),
  });

  async function handleDownload(row: FiscalInstruction) {
    if (!row.pdf_file) {
      notify.warning('Esta instrução não possui arquivo anexado.');
      return;
    }
    try {
      const blob = await fiscalApi.downloadDocument(row.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (row.instruction_name || 'instrucao-fiscal').replace(/[^a-z0-9]+/gi, '_');
      link.setAttribute('download', `${safeName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Não foi possível baixar o documento.'));
    }
  }

  function handleView(row: FiscalInstruction) {
    if (row.pdf_file_url) {
      window.open(row.pdf_file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    notify.warning('Esta instrução não possui arquivo anexado.');
  }

  function setFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const columns: Column<FiscalInstruction>[] = [
    {
      key: 'instruction_name',
      header: 'Orientação fiscal',
      render: (r) => r.instruction_name || '-',
    },
    {
      key: 'branch_name',
      header: 'Filial',
      width: '180px',
      render: (r) => r.branch_name || '-',
    },
    {
      key: 'harvest_year',
      header: 'Safra',
      width: '90px',
      render: (r) => r.harvest_year || '-',
    },
    {
      key: 'product',
      header: 'Produto',
      width: '120px',
      render: (r) => r.product || '-',
    },
    {
      key: 'person_type',
      header: 'Emitente',
      width: '110px',
      render: (r) => r.person_type_display,
    },
    {
      key: 'issuer_state',
      header: 'UF emitente',
      width: '110px',
      render: (r) => r.issuer_state || '-',
    },
    {
      key: 'has_nf_future_delivery',
      header: 'NF EF',
      width: '80px',
      render: (r) => (r.has_nf_future_delivery ? 'Sim' : 'Não'),
    },
    {
      key: 'pdf',
      header: 'Arquivo',
      width: '110px',
      render: (r) =>
        r.pdf_file ? (
          <Badge variant="success">PDF</Badge>
        ) : (
          <Badge variant="default">Sem arquivo</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleView(r)}
            disabled={!r.pdf_file}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Visualizar"
            title="Abrir documento"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDownload(r)}
            disabled={!r.pdf_file}
            className="p-1.5 rounded hover:bg-brand-blue/10 text-brand-blue disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Baixar"
            title="Baixar documento"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Instruções Fiscais</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Consulte as orientações fiscais cadastradas pela equipe e baixe os documentos
          correspondentes. O cadastro é feito pela equipe fiscal no painel administrativo.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
        <FilterSelect
          label="Filial"
          value={branch.value}
          onChange={(v) => setFilter(branch.set, v)}
          options={branchOptions}
        />
        <FilterSelect
          label="Produto"
          value={product.value}
          onChange={(v) => setFilter(product.set, v)}
          options={[
            { value: '', label: 'Todos os produtos' },
            { value: 'SOJA', label: 'Soja' },
            { value: 'MILHO', label: 'Milho' },
          ]}
        />
        <FilterSelect
          label="Emitente"
          value={personType.value}
          onChange={(v) => setFilter(personType.set, v)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'PF', label: 'Pessoa Física (PF)' },
            { value: 'PJ', label: 'Pessoa Jurídica (PJ)' },
          ]}
        />
        <FilterSelect
          label="UF emitente"
          value={issuerState.value}
          onChange={(v) => setFilter(issuerState.set, v)}
          options={[
            { value: '', label: 'Todos os estados' },
            ...UF_OPTIONS.map((uf) => ({ value: uf, label: uf })),
          ]}
        />
        <FilterSelect
          label="Safra"
          value={harvestYear.value}
          onChange={(v) => setFilter(harvestYear.set, v)}
          options={[
            { value: '', label: 'Todas' },
            { value: '2025', label: '2025' },
            { value: '2026', label: '2026' },
            { value: '2027', label: '2027' },
          ]}
        />
      </div>

      <DataTable<FiscalInstruction>
        columns={columns}
        data={data?.results ?? []}
        totalItems={data?.count ?? 0}
        currentPage={page}
        pagination={{
          enabled: true,
          pageSize,
          onPageChange: (p) => setPage(p),
          onPageSizeChange: (s) => setPageSize(s),
        }}
      />
      {isLoading && (
        <div className="p-4 text-center text-sm text-text-tertiary">Carregando…</div>
      )}
      {!isLoading && (data?.results ?? []).length === 0 && (
        <div className="p-8 text-center text-sm text-text-tertiary">
          Nenhuma instrução fiscal encontrada para os filtros atuais.
        </div>
      )}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="block text-sm">
      <span className="text-text-tertiary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-brand-blue focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
