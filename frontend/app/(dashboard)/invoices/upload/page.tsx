'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { Upload, CheckCircle2, AlertTriangle, ExternalLink, RotateCcw } from 'lucide-react';

import { invoicesApi, type UploadExcelResponse } from '@/lib/api/invoices';
import { FileUpload } from '@/components/ui/file-upload';
import { ButtonPrimary } from '@/components/ui/button-primary';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/lib/errors';

export default function NFUploadBasePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [report, setReport] = useState<UploadExcelResponse | null>(null);

  const uploadMutation = useMutation({
    mutationFn: ({ file, dryRun: d }: { file: File; dryRun: boolean }) =>
      invoicesApi.uploadExcel(file, d),
    onSuccess: (res) => {
      setFormError(null);
      setReport(res);
    },
    onError: (err) => {
      setFormError(getErrorMessage(err, 'Falha ao processar a planilha.'));
      setReport(null);
    },
  });

  function handleFilesSelected(files: File[]) {
    if (!files[0]) return;
    setSelectedFile(files[0]);
    setFormError(null);
    setReport(null);
  }

  function handleSubmit() {
    if (!selectedFile) {
      setFormError('Selecione um arquivo .xlsx antes de enviar.');
      return;
    }
    setFormError(null);
    uploadMutation.mutate({ file: selectedFile, dryRun });
  }

  function handleReset() {
    setSelectedFile(null);
    setReport(null);
    setFormError(null);
    uploadMutation.reset();
  }

  const isImporting = uploadMutation.isPending;
  const isCommitted = Boolean(report && !report.dry_run);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            NF Entrega Futura — Upload das NFs filhas
          </h1>
          <p className="mt-1 text-sm text-text-tertiary">
            Importação em lote das NFs filhas (<strong>Remessas</strong>). Cada linha da
            planilha precisa ter a coluna <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">Contrato</code>,
            que deve corresponder a um contrato já cadastrado e com NF mãe já criada em{' '}
            <strong>Gestão de Saldos</strong>.
          </p>
        </div>
        <Link
          href="/invoices/balances"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-blue hover:underline"
        >
          Gestão de saldos
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload form */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">1. Envio da planilha</h2>

          <FileUpload
            accept=".xlsx,.xls"
            multiple={false}
            label={
              selectedFile
                ? `Arquivo selecionado: ${selectedFile.name}`
                : 'Arraste o arquivo .xlsx ou clique para selecionar'
            }
            disabled={isImporting}
            onFilesSelected={handleFilesSelected}
          />

          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                checked={dryRun}
                disabled={isImporting}
                onChange={(e) => {
                  setDryRun(e.target.checked);
                  setReport(null);
                }}
              />
              <span>
                <span className="block font-medium text-text-primary">
                  Executar em modo simulação (dry-run)
                </span>
                <span className="block text-xs text-text-tertiary">
                  Valida a planilha sem salvar no banco. Desmarque para confirmar a importação.
                </span>
              </span>
            </label>
          </div>

          {formError && (
            <div
              role="alert"
              className="mt-4 rounded-md bg-error-light px-3 py-2 text-sm text-error"
            >
              {formError}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <ButtonPrimary
              icon={Upload}
              onClick={handleSubmit}
              disabled={!selectedFile || isImporting}
            >
              {isImporting
                ? 'Processando…'
                : dryRun
                  ? 'Simular importação'
                  : 'Importar agora'}
            </ButtonPrimary>
            {(selectedFile || report) && !isImporting && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Limpar
              </button>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-text-tertiary">
            <p className="font-medium text-text-secondary">Regras de importação:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>
                Esta planilha é apenas para <strong>NFs filhas</strong> (Remessas). As NFs
                mães devem ser cadastradas em{' '}
                <Link href="/invoices/balances" className="text-brand-blue hover:underline">
                  Gestão de Saldos
                </Link>
                .
              </li>
              <li>
                Cada linha é vinculada à NF mãe pelo <code>Contrato</code> /{' '}
                <code>Lote de Compra</code>. Se nenhuma NF mãe for encontrada para esse
                contrato, a linha é reportada como erro.
              </li>
              <li>
                A <code>Quantidade</code> negativa (formato da planilha origem) é armazenada
                como valor absoluto.
              </li>
              <li>
                Após a importação, o saldo da NF mãe é recalculado como{' '}
                <code>Quantidade − soma das filhas</code>.
              </li>
              <li>
                Linhas sem <code>Nr. Nota</code>, <code>Quantidade</code> ou <code>Contrato</code>{' '}
                são reportadas como erro e ignoradas.
              </li>
            </ul>
          </div>
        </div>

        {/* Results panel */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">2. Resultado</h2>

          {!report && !isImporting && (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-text-tertiary">
              Envie uma planilha para ver o resumo da importação aqui.
            </div>
          )}

          {isImporting && (
            <div className="rounded-md bg-slate-50 p-6 text-center text-sm text-text-tertiary">
              Processando arquivo…
            </div>
          )}

          {report && (
            <>
              <div className="mb-4 flex items-center gap-2">
                {isCommitted ? (
                  <Badge variant="success">Importado</Badge>
                ) : (
                  <Badge variant="info">Simulação</Badge>
                )}
                {isCommitted ? (
                  <span className="inline-flex items-center gap-1 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" /> Registros salvos com sucesso.
                  </span>
                ) : (
                  <span className="text-sm text-text-tertiary">
                    Nada foi gravado. Desmarque &ldquo;dry-run&rdquo; para confirmar.
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Linhas lidas" value={report.rows_total} />
                <Stat label="Válidas" value={report.rows_valid} />
                <Stat label="Inválidas" value={report.rows_invalid} tone="warning" />
                <Stat label="Com erro" value={report.errors.length} tone="warning" />
                <Stat label="Filhas criadas" value={report.children_created} tone="success" />
                <Stat label="Filhas atualizadas" value={report.children_updated} tone="info" />
              </dl>

              {report.errors.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    Linhas com erro
                  </h3>
                  <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-text-secondary">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Linha</th>
                          <th className="px-3 py-2 text-left font-medium">Nº NF</th>
                          <th className="px-3 py-2 text-left font-medium">Erro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.errors.map((e, i) => (
                          <tr key={`${e.row}-${i}`}>
                            <td className="px-3 py-1.5 font-mono">{e.row}</td>
                            <td className="px-3 py-1.5">{e.nf_number || '—'}</td>
                            <td className="px-3 py-1.5 text-text-secondary">{e.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {report.results.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold text-text-secondary">
                    NFs processadas ({report.results.length})
                  </h3>
                  <div className="max-h-56 overflow-auto rounded-md border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-text-secondary">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Linha</th>
                          <th className="px-3 py-2 text-left font-medium">Nº NF</th>
                          <th className="px-3 py-2 text-left font-medium">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.results.map((r) => (
                          <tr key={r.nf_id}>
                            <td className="px-3 py-1.5 font-mono">{r.row}</td>
                            <td className="px-3 py-1.5">{r.nf_number}</td>
                            <td className="px-3 py-1.5">
                              <Badge variant={r.status === 'created' ? 'success' : 'info'}>
                                {r.status === 'created' ? 'Criada' : 'Atualizada'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning' | 'info';
}) {
  const toneClass = {
    default: 'text-text-primary',
    success: 'text-success',
    warning: 'text-warning',
    info: 'text-brand-blue',
  }[tone];
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</dd>
    </div>
  );
}
