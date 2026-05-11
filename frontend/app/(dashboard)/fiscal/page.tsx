'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink } from 'lucide-react';

import { fiscalApi, type FiscalInstruction, type PersonType } from '@/lib/api/fiscal';
import { lookupsApi, type Branch } from '@/lib/api/lookups';
import { DataTable, type Column, type ColumnFilter } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/errors';
import { useUrlPagination } from '@/lib/hooks/use-url-pagination';

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function FiscalInstructionsPage() {
  const { page, pageSize, setPage, setPageSize } = useUrlPagination();
  const [filters, setFilters] = useState<ColumnFilter[]>([]);

  const { data: branches } = useQuery({
    queryKey: ['lookups', 'branches'],
    queryFn: () => lookupsApi.branches(),
  });

  const filterParams = filters.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {} as Record<string, string>);

  const listParams = {
    page,
    page_size: pageSize,
    is_active: true,
    ...filterParams,
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

  const columns: Column<FiscalInstruction>[] = [
    {
      key: 'instruction_name',
      header: 'Orientação fiscal',
      filterable: true,
      filterType: 'text',
      render: (r) => r.instruction_name || '-',
    },
    {
      key: 'branch',
      header: 'Filial',
      width: '180px',
      filterable: true,
      filterType: 'select',
      filterOptions: (branches ?? []).map((b: Branch) => ({
        value: b.id,
        label: `${b.sap_code} — ${b.description}`,
      })),
      render: (r) => r.branch_name || '-',
    },
    {
      key: 'harvest_year',
      header: 'Safra',
      width: '90px',
      filterable: true,
      filterType: 'text',
      render: (r) => r.harvest_year || '-',
    },
    {
      key: 'product',
      header: 'Produto',
      width: '120px',
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: 'Soja', value: 'SOJA' },
        { label: 'Milho', value: 'MILHO' },
      ],
      render: (r) => r.product || '-',
    },
    {
      key: 'person_type',
      header: 'Emitente',
      width: '110px',
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: 'Pessoa Física (PF)', value: 'PF' },
        { label: 'Pessoa Jurídica (PJ)', value: 'PJ' },
      ],
      render: (r) => r.person_type_display,
    },
    {
      key: 'issuer_state',
      header: 'UF emitente',
      width: '110px',
      filterable: true,
      filterType: 'select',
      filterOptions: UF_OPTIONS.map((uf) => ({ label: uf, value: uf })),
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

      <DataTable<FiscalInstruction>
        columns={columns}
        data={data?.results ?? []}
        totalItems={data?.count ?? 0}
        currentPage={page}
        filters={filters}
        onFilterChange={(f) => { setFilters(f); setPage(1); }}
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
