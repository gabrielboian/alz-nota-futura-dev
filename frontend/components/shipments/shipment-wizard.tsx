'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Truck } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { ProducerCombobox } from '@/components/ui/producer-combobox';
import { TransportadoraCombobox } from '@/components/ui/transportadora-combobox';
import {
  contractsApi,
  type ContractManagedLot,
  type ContractManagedLotUpdate,
} from '@/lib/api/contracts';
import { lookupsApi, type Branch } from '@/lib/api/lookups';
import { shipmentsApi } from '@/lib/api/shipments';
import { getErrorMessage } from '@/lib/errors';
import { notify } from '@/lib/notify';

interface ShipmentWizardProps {
  lot: ContractManagedLot | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** `request` (default): commercial solicita. `approve`: logística aprova e preenche campos extras. */
  mode?: 'request' | 'approve';
  /** Required when mode is 'approve'. */
  shipmentRequestId?: string;
}

const STEP_LABELS = [
  'Dados contrato',
  'Dados local embarque',
  'Dados Logísticos',
  'Orientações Fiscais',
] as const;

function formatDecimal(value: string | number | null | undefined, digits = 3) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCurrency(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type FormState = {
  harvest_year: string;
  pickup_location: string;
  loading_site: string;
  collection_point_code: string;
  loading_state_registration: string;
  freight_type_exit: string | null;
  region: string;
  phone: string;
  email: string;
  route_description: string;
  scale_over_25m: boolean;
  silo_bag_loading: boolean;
  has_transshipment: boolean;
  transshipment_location: string | null;
  terminal_destination: string | null;
  delivery_window_start: string;
  delivery_window_end: string;
  has_participant: boolean;
  participant: string | null;
  delivered_by_holder: boolean;
  billing_producer_name: string;
  client_state_registration: string;
  cnpj_billing: string;
  commercial_responsible: string | null;
  // Logistics-only (approve mode)
  rfl_value_kg: string;
  executed_freight_value: string;
  corridor: string | null;
  freight_agent: string;
  /** CPT only: ordered list of selected transportadora codes. First code → freight_agent. */
  freight_agents_cpt: string[];
  scheduling: string;
  route_info: boolean;
  billing_branch: string | null;
  has_nf_future_delivery: boolean;
  nf_key_future_delivery: string;
};

function initialForm(lot: ContractManagedLot | null): FormState {
  return {
    harvest_year: lot?.harvest_year ?? '',
    pickup_location: lot?.pickup_location || lot?.base_lot_data?.load_city || '',
    loading_site: lot?.loading_site || lot?.base_lot_data?.load_location || '',
    collection_point_code: lot?.collection_point_code || lot?.base_lot_data?.address_code || '',
    loading_state_registration: lot?.loading_state_registration ?? '',
    freight_type_exit: lot?.freight_type_exit ?? null,
    region: lot?.region ?? '',
    phone: lot?.phone ?? '',
    email: lot?.email ?? '',
    route_description: lot?.route_description ?? '',
    scale_over_25m: lot?.scale_over_25m ?? false,
    silo_bag_loading: lot?.silo_bag_loading ?? false,
    has_transshipment: lot?.has_transshipment ?? false,
    transshipment_location: lot?.transshipment_location ?? null,
    terminal_destination: lot?.terminal_destination ?? null,
    delivery_window_start: lot?.delivery_window_start ?? '',
    delivery_window_end: lot?.delivery_window_end ?? '',
    has_participant: lot?.has_participant ?? false,
    participant: lot?.participant ?? null,
    delivered_by_holder: lot?.delivered_by_holder ?? true,
    billing_producer_name:
      lot?.billing_producer_name || lot?.base_lot_data?.producer_name || '',
    client_state_registration: lot?.client_state_registration ?? '',
    cnpj_billing: lot?.cnpj_billing || lot?.base_lot_data?.cpf_cnpj || '',
    commercial_responsible: lot?.commercial_responsible ?? null,
    rfl_value_kg: lot?.rfl_value_kg ?? '',
    executed_freight_value: lot?.executed_freight_value ?? '',
    corridor: lot?.corridor ?? null,
    freight_agent: lot?.freight_agent ?? '',
    freight_agents_cpt: lot?.freight_agent ? [lot.freight_agent] : [],
    scheduling: lot?.scheduling ?? '',
    route_info: lot?.route_info ?? false,
    billing_branch: lot?.billing_branch ?? null,
    has_nf_future_delivery: lot?.has_nf_future_delivery ?? false,
    nf_key_future_delivery: lot?.nf_key_future_delivery ?? '',
  };
}

/** Branch 3517 cannot be used for billing — user must pick 3504 or 3509. */
function isBillingCnpjLocked(lot: ContractManagedLot | null) {
  const branch = lot?.base_lot_data?.branch_name ?? '';
  return /3517/.test(branch);
}

export function ShipmentWizard({
  lot,
  isOpen,
  onClose,
  onSuccess,
  mode = 'request',
  shipmentRequestId,
}: ShipmentWizardProps) {
  const queryClient = useQueryClient();
  const isApprove = mode === 'approve';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => initialForm(lot));
  const [confirmations, setConfirmations] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  // Reset state whenever the wizard opens for a new lot.
  useEffect(() => {
    if (isOpen && lot) {
      setStep(1);
      setForm(initialForm(lot));
      setConfirmations({});
      setError(null);
      setFieldErrors({});
      setNotes('');
    }
  }, [isOpen, lot]);

  const terminalsQuery = useQuery({
    queryKey: ['lookup-terminals'],
    queryFn: lookupsApi.terminals,
    enabled: isOpen,
  });
  const transshipmentsQuery = useQuery({
    queryKey: ['lookup-transshipments'],
    queryFn: lookupsApi.transshipments,
    enabled: isOpen,
  });
  const participantsQuery = useQuery({
    queryKey: ['lookup-participants'],
    queryFn: () => lookupsApi.participants(),
    enabled: isOpen,
  });
  const commercialsQuery = useQuery({
    queryKey: ['lookup-commercial-responsibles'],
    queryFn: lookupsApi.commercialResponsibles,
    enabled: isOpen,
  });
  const corridorsQuery = useQuery({
    queryKey: ['lookup-corridors'],
    queryFn: lookupsApi.corridors,
    enabled: isOpen && isApprove,
  });
  const tipoFreteSaidaQuery = useQuery({
    queryKey: ['lookup-tipo-frete-saida'],
    queryFn: lookupsApi.tipoFreteSaida,
    enabled: isOpen,
  });
  const branchesQuery = useQuery({
    queryKey: ['lookup-branches'],
    queryFn: lookupsApi.branches,
    enabled: isOpen,
  });

  const billingLocked = isBillingCnpjLocked(lot);

  // Reactively sync freight_agent when CIF billing_branch changes or FOB collection_point_code changes.
  useEffect(() => {
    if (!isOpen || !form.freight_type_exit) return;
    const tipo = tipoFreteSaidaQuery.data?.find((t) => t.id === form.freight_type_exit);
    const tipoName = (tipo?.name ?? '').toUpperCase();
    if (tipoName.includes('CIF')) {
      if (!form.billing_branch || !branchesQuery.data) return;
      const branch = branchesQuery.data.find((b) => b.id === form.billing_branch);
      const code = branch?.cif_transportadora_code ?? '';
      setForm((s) => (s.freight_agent === code ? s : { ...s, freight_agent: code }));
    } else if (tipoName.includes('FOB')) {
      setForm((s) =>
        s.freight_agent === s.collection_point_code
          ? s
          : { ...s, freight_agent: s.collection_point_code },
      );
    }
  }, [
    form.billing_branch,
    form.collection_point_code,
    form.freight_type_exit,
    isOpen,
    branchesQuery.data,
    tipoFreteSaidaQuery.data,
  ]);

  // Auto-fill billing_branch from the contract's branch when branches load.
  useEffect(() => {
    if (!isOpen || !branchesQuery.data || !lot || form.billing_branch) return;
    const branchName = (lot.base_lot_data?.branch_name ?? '').trim();
    if (!branchName) return;
    const match = branchesQuery.data.find(
      (b) => b.sap_code.toLowerCase() === branchName.toLowerCase(),
    );
    // 3517 cannot be the emitter — leave null so user picks a valid TO alternative.
    if (match && !/3517/.test(match.sap_code)) {
      setForm((s) => (s.billing_branch ? s : { ...s, billing_branch: match.id }));
    }
  }, [isOpen, branchesQuery.data, lot, form.billing_branch]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!lot) throw new Error('Lote inválido.');
      const base: ContractManagedLotUpdate = {
        harvest_year: form.harvest_year.trim(),
        pickup_location: form.pickup_location.trim(),
        loading_site: form.loading_site.trim(),
        collection_point_code: form.collection_point_code.trim(),
        loading_state_registration: form.loading_state_registration.trim(),
        freight_type_exit: form.freight_type_exit,
        region: form.region.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        route_description: form.route_description.trim(),
        scale_over_25m: form.scale_over_25m,
        silo_bag_loading: form.silo_bag_loading,
        has_transshipment: form.has_transshipment,
        transshipment_location: form.has_transshipment ? form.transshipment_location : null,
        terminal_destination: form.terminal_destination,
        delivery_window_start: form.delivery_window_start || null,
        delivery_window_end: form.delivery_window_end || null,
        has_participant: form.has_participant,
        participant: form.has_participant ? form.participant : null,
        delivered_by_holder: form.delivered_by_holder,
        billing_producer_name: form.billing_producer_name.trim(),
        client_state_registration: form.client_state_registration.trim(),
        cnpj_billing: billingLocked ? '' : form.cnpj_billing.trim(),
        commercial_responsible: form.commercial_responsible,
        billing_branch: form.billing_branch,
        has_nf_future_delivery: form.has_nf_future_delivery,
        nf_key_future_delivery: form.nf_key_future_delivery.trim(),
      };
      const payload: ContractManagedLotUpdate = isApprove
        ? {
            ...base,
            rfl_value_kg: form.rfl_value_kg ? Number(form.rfl_value_kg) : 0,
            executed_freight_value: form.executed_freight_value
              ? Number(form.executed_freight_value)
              : 0,
            corridor: form.corridor,
            freight_agent: form.freight_agent.trim(),
            scheduling: form.scheduling.trim(),
            // freight_agents_cpt is UI-only; not sent to backend
            route_info: form.route_info,
          }
        : base;
      await contractsApi.updateManagedLot(lot.id, payload);
      if (isApprove) {
        if (!shipmentRequestId) throw new Error('Solicitação inválida.');
        await shipmentsApi.approve(shipmentRequestId);
      } else {
        await shipmentsApi.create({
          managed_lot: lot.id,
          notes: notes.trim() || undefined,
        });
      }
    },
    onSuccess: () => {
      notify.success(
        isApprove ? 'Embarque liberado.' : 'Solicitação de embarque enviada.'
      );
      queryClient.invalidateQueries({ queryKey: ['shipment-awaiting-lots'] });
      queryClient.invalidateQueries({ queryKey: ['contract-managed-lots'] });
      queryClient.invalidateQueries({ queryKey: ['shipment-requests'] });
      onSuccess();
    },
    onError: (err) => {
      // Capture DRF field errors when available.
      // biome-ignore lint/suspicious/noExplicitAny: axios error shape
      const data = (err as any)?.response?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const fe: Record<string, string> = {};
        Object.entries(data).forEach(([k, v]) => {
          fe[k] = Array.isArray(v) ? String(v[0]) : String(v);
        });
        setFieldErrors(fe);
      }
      setError(getErrorMessage(err, 'Não foi possível enviar a solicitação.'));
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
    setFieldErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }

  function validateStep(n: number): boolean {
    const errs: Record<string, string> = {};
    if (n === 1) {
      if (!form.harvest_year.trim()) errs.harvest_year = 'Informe a safra.';
    } else if (n === 2) {
      if (!form.pickup_location.trim()) errs.pickup_location = 'Informe a cidade do embarque.';
      if (!form.loading_site.trim()) errs.loading_site = 'Informe o local de retirada.';
      if (!form.region.trim()) errs.region = 'Informe a região.';
      if (!form.phone.trim()) errs.phone = 'Informe o telefone.';
      if (!form.email.trim()) errs.email = 'Informe o e-mail.';
      if (!form.route_description.trim()) errs.route_description = 'Descreva o roteiro.';
    } else if (n === 3) {
      if (!form.terminal_destination) errs.terminal_destination = 'Selecione o terminal destino.';
      if (form.has_transshipment && !form.transshipment_location) {
        errs.transshipment_location = 'Selecione o local de transbordo.';
      }
      if (!form.delivery_window_start) errs.delivery_window_start = 'Informe a data inicial.';
      if (!form.delivery_window_end) errs.delivery_window_end = 'Informe a data final.';
      if (
        form.delivery_window_start &&
        form.delivery_window_end &&
        form.delivery_window_end < form.delivery_window_start
      ) {
        errs.delivery_window_end = 'Data final deve ser ≥ inicial.';
      }
      if (isApprove) {
        if (!form.collection_point_code.trim()) errs.collection_point_code = 'Informe o código ponto de coleta.';
        if (!form.freight_type_exit) errs.freight_type_exit = 'Selecione o tipo de frete saída.';
        if (!form.rfl_value_kg || Number(form.rfl_value_kg) <= 0) {
          errs.rfl_value_kg = 'Informe o valor de pauta RFL.';
        }
        if (!form.executed_freight_value || Number(form.executed_freight_value) <= 0) {
          errs.executed_freight_value = 'Informe o valor do frete executado.';
        }
        if (!form.corridor) errs.corridor = 'Selecione o corredor.';
        if (!form.scheduling.trim()) errs.scheduling = 'Informe o agendamento.';
      }
    } else if (n === 4) {
      if (form.has_participant && !form.participant) {
        errs.participant = 'Selecione o participante.';
      }
      if (!form.billing_producer_name.trim()) errs.billing_producer_name = 'Informe o nome do produtor de faturamento.';
      if (!form.commercial_responsible) errs.commercial_responsible = 'Selecione o comercial responsável.';
      if (!form.billing_branch) errs.billing_branch = 'Selecione a filial emissora da ordem.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    setError(null);
    if (!validateStep(step)) return;
    if (!confirmations[step]) return;
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function submit() {
    setError(null);
    if (!validateStep(4)) return;
    if (!confirmations[4]) return;
    submitMutation.mutate();
  }

  const canAdvance = confirmations[step] === true;
  const isPending = submitMutation.isPending;

  if (!lot) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => (!isPending ? onClose() : null)}
      title={isApprove ? 'Liberar embarque' : 'Solicitar liberação embarque'}
      closeOnEscape={!isPending}
      className="max-w-4xl"
    >
      <div className="flex flex-col">
        <StepIndicator current={step} />

        <div className="max-h-[65vh] overflow-y-auto p-6">
          {step === 1 && <Step1 lot={lot} form={form} update={update} fieldErrors={fieldErrors} />}
          {step === 2 && <Step2 form={form} update={update} fieldErrors={fieldErrors} />}
          {step === 3 && (
            <Step3
              form={form}
              update={update}
              fieldErrors={fieldErrors}
              terminals={terminalsQuery.data ?? []}
              transshipments={transshipmentsQuery.data ?? []}
              showLogistics={isApprove}
              corridors={corridorsQuery.data ?? []}
              tipoFreteSaida={tipoFreteSaidaQuery.data ?? []}
              branches={branchesQuery.data ?? []}
              billingBranch={form.billing_branch}
            />
          )}
          {step === 4 && (
            <Step4
              form={form}
              update={update}
              fieldErrors={fieldErrors}
              participants={participantsQuery.data ?? []}
              commercials={commercialsQuery.data ?? []}
              branches={branchesQuery.data ?? []}
              billingLocked={billingLocked}
              notes={notes}
              setNotes={setNotes}
            />
          )}

          <label className="mt-6 flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-blue"
              checked={confirmations[step] === true}
              onChange={(e) => setConfirmations((c) => ({ ...c, [step]: e.target.checked }))}
              disabled={isPending}
            />
            <span className="text-text-primary">
              {step === 1
                ? 'Declaro ter verificado que este é o contrato/lote do qual eu desejo realizar a liberação.'
                : step === 4
                ? 'Confirmo que as informações fiscais estão corretas e liberadas para envio.'
                : 'Confirmo que as informações desta etapa estão corretas.'}
            </span>
          </label>

          {error && (
            <div role="alert" className="mt-4 rounded-md bg-error-light px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={step === 1 ? onClose : goBack}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? 'Cancelar' : 'Retornar'}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canAdvance || isPending}
              className="inline-flex items-center gap-1 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
            >
              Avançar
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canAdvance || isPending}
              className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
            >
              <Truck className="h-4 w-4" />
              {isPending
                ? 'Enviando…'
                : isApprove
                ? 'Liberar Embarque'
                : 'Solicitar Embarque'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
      {STEP_LABELS.map((label, idx) => {
        const n = idx + 1;
        const isActive = n === current;
        const isDone = n < current;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 aspect-square items-center justify-center rounded-full text-xs font-semibold ${
                isDone
                  ? 'bg-success text-white'
                  : isActive
                  ? 'bg-brand-blue text-white'
                  : 'bg-slate-200 text-text-tertiary'
              }`}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <span
              className={`hidden text-xs font-medium sm:inline ${
                isActive ? 'text-text-primary' : 'text-text-tertiary'
              }`}
            >
              {label}
            </span>
            {n < STEP_LABELS.length && (
              <div className="ml-1 hidden h-px flex-1 bg-slate-200 sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Shared field primitives ----------

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1 block text-xs font-medium text-text-primary">
      {children}
      {required && <span className="ml-1 text-error">*</span>}
    </span>
  );
}

function ReadOnly({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className="wrap-break-word rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-primary">
        {value || '-'}
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <span className="mt-1 block text-xs text-error">{msg}</span>;
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-xs">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`rounded px-3 py-1 font-medium ${
          value ? 'bg-brand-blue text-white' : 'text-text-secondary'
        }`}
      >
        Sim
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`rounded px-3 py-1 font-medium ${
          !value ? 'bg-brand-blue text-white' : 'text-text-secondary'
        }`}
      >
        Não
      </button>
    </div>
  );
}

// ---------- Steps ----------

type UpdateFn = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function Step1({
  lot,
  form,
  update,
  fieldErrors,
}: {
  lot: ContractManagedLot;
  form: FormState;
  update: UpdateFn;
  fieldErrors: Record<string, string>;
}) {
  const b = lot.base_lot_data;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label required>Safra</Label>
        <input
          type="text"
          value={form.harvest_year}
          onChange={(e) => update('harvest_year', e.target.value)}
          placeholder="Ex.: 2025/2026"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <FieldError msg={fieldErrors.harvest_year} />
      </div>
      <ReadOnly label="Produto" value={b?.product} />
      <ReadOnly label="Cliente" value={b?.producer_name} />
      <ReadOnly label="Filial" value={b?.branch_name} />
      <ReadOnly label="Contrato" value={b?.lot_number} />
      <ReadOnly label="Qtd Lote (KG)" value={formatDecimal(b?.quantity_kg)} />
      <ReadOnly label="Vlr Frete" value={formatCurrency(b?.freight_value)} />
      <ReadOnly label="CPF/CNPJ" value={b?.cpf_cnpj} />
      <ReadOnly label="Tipo Frete" value={b?.freight_type} />
    </div>
  );
}

function Step2({
  form,
  update,
  fieldErrors,
}: {
  form: FormState;
  update: UpdateFn;
  fieldErrors: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label required>Cidade do Embarque</Label>
        <input
          type="text"
          value={form.pickup_location}
          onChange={(e) => update('pickup_location', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <FieldError msg={fieldErrors.pickup_location} />
      </div>
      <div>
        <Label required>Local de Retirada</Label>
        <input
          type="text"
          value={form.loading_site}
          onChange={(e) => update('loading_site', e.target.value)}
          placeholder="Informe o nome da Fazenda ou Armazém, onde será realizado o embarque do produto."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <FieldError msg={fieldErrors.loading_site} />
      </div>
      <div>
        <Label required>Região</Label>
        <input
          type="text"
          value={form.region}
          onChange={(e) => update('region', e.target.value)}
          placeholder="Informe o nome da região do embarque…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <FieldError msg={fieldErrors.region} />
      </div>
      <div>
        <Label required>Nº Telefone Local Embarque</Label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          placeholder="(00) 0 0000-0000"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <FieldError msg={fieldErrors.phone} />
      </div>
      <div>
        <Label required>E-mail Local Embarque</Label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="fazenda@email.com"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <FieldError msg={fieldErrors.email} />
      </div>
      <div className="sm:col-span-2">
        <Label required>Roteiro</Label>
        <textarea
          value={form.route_description}
          onChange={(e) => update('route_description', e.target.value)}
          rows={3}
          placeholder="Descreva de forma detalhada o roteiro para chegar até o local de embarque."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <FieldError msg={fieldErrors.route_description} />
      </div>
      <div>
        <Label>Balança maior 25 metros?</Label>
        <Toggle value={form.scale_over_25m} onChange={(v) => update('scale_over_25m', v)} />
      </div>
      <div>
        <Label>Carregamento Silo bolsa?</Label>
        <Toggle value={form.silo_bag_loading} onChange={(v) => update('silo_bag_loading', v)} />
      </div>
    </div>
  );
}

function Step3({
  form,
  update,
  fieldErrors,
  terminals,
  transshipments,
  showLogistics = false,
  corridors = [],
  tipoFreteSaida = [],
  branches = [],
  billingBranch = null,
}: {
  form: FormState;
  update: UpdateFn;
  fieldErrors: Record<string, string>;
  terminals: { id: string; name: string; sap_client_code?: string; sap_supplier_code?: string }[];
  transshipments: { id: string; name: string; branch_sap_code?: string }[];
  showLogistics?: boolean;
  corridors?: { id: string; name: string }[];
  tipoFreteSaida?: { id: string; name: string }[];
  branches?: Branch[];
  billingBranch?: string | null;
}) {
  const selectedTipo = tipoFreteSaida.find((t) => t.id === form.freight_type_exit);
  const tipoName = (selectedTipo?.name ?? '').toUpperCase();
  const isCIF = tipoName.includes('CIF');
  const isFOB = tipoName.includes('FOB');
  const isCPT = tipoName.includes('CPT');
  const effectiveCifCode = branches.find((b) => b.id === billingBranch)?.cif_transportadora_code ?? '';

  function handleFreightTypeChange(value: string | null) {
    update('freight_type_exit', value);
    // Auto-fill freight_agent based on freight type
    if (!value) return;
    const tipo = tipoFreteSaida.find((t) => t.id === value);
    const name = (tipo?.name ?? '').toUpperCase();
    if (name.includes('CIF')) {
      update('freight_agent', effectiveCifCode);
      update('freight_agents_cpt', []);
    } else if (name.includes('FOB')) {
      update('freight_agent', form.collection_point_code);
      update('freight_agents_cpt', []);
    } else if (name.includes('CPT')) {
      update('freight_agent', '');
      update('freight_agents_cpt', []);
    }
  }
  const rflSack = form.rfl_value_kg
    ? (Number(form.rfl_value_kg) * 60).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : '-';
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label>Terá local de transbordo?</Label>
        <Toggle
          value={form.has_transshipment}
          onChange={(v) => {
            update('has_transshipment', v);
            if (!v) update('transshipment_location', null);
          }}
        />
      </div>
      {form.has_transshipment && (
        <div>
          <Label required>Local Transbordo</Label>
          <select
            value={form.transshipment_location ?? ''}
            onChange={(e) => update('transshipment_location', e.target.value || null)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          >
            <option value="">Selecione…</option>
            {transshipments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.branch_sap_code ? `${t.branch_sap_code} - ${t.name}` : t.name}
              </option>
            ))}
          </select>
          <FieldError msg={fieldErrors.transshipment_location} />
        </div>
      )}
      <div className={form.has_transshipment ? '' : 'sm:col-span-2'}>
        <Label required>Terminal Destino</Label>
        <select
          value={form.terminal_destination ?? ''}
          onChange={(e) => update('terminal_destination', e.target.value || null)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        >
          <option value="">Selecione…</option>
          {terminals.map((t) => (
            <option key={t.id} value={t.id}>
              {t.sap_client_code ? `${t.sap_client_code} - ${t.name}` : t.name}
            </option>
          ))}
        </select>
        <FieldError msg={fieldErrors.terminal_destination} />
      </div>
      {showLogistics && (
        <>
          <div>
            <Label required>Código Ponto de Coleta</Label>
            <input
              type="text"
              value={form.collection_point_code}
              onChange={(e) => update('collection_point_code', e.target.value)}
              placeholder="Cód. fornecedor SAP do local de carregamento"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
            <span className="mt-1 block text-xs text-text-tertiary">
              Informe o código fornecedor SAP do local de carregamento. Realizar a busca no SAP por meio da inscrição estadual na XK03.
            </span>
            <FieldError msg={fieldErrors.collection_point_code} />
          </div>
          <div>
            <Label>Inscrição Estadual do Cliente</Label>
            <input
              type="text"
              value={form.loading_state_registration}
              onChange={(e) => update('loading_state_registration', e.target.value)}
              placeholder="Digite a inscrição estadual"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
            <FieldError msg={fieldErrors.loading_state_registration} />
          </div>
          <div>
            <Label required>Tipo Frete Saída</Label>
            <select
              value={form.freight_type_exit ?? ''}
              onChange={(e) => handleFreightTypeChange(e.target.value || null)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            >
              <option value="">Selecione…</option>
              {tipoFreteSaida.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <FieldError msg={fieldErrors.freight_type_exit} />
          </div>
        </>
      )}
      <div>
        <Label required>Janela entrega — Data Início</Label>
        <input
          type="date"
          value={form.delivery_window_start}
          onChange={(e) => update('delivery_window_start', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <FieldError msg={fieldErrors.delivery_window_start} />
      </div>
      <div>
        <Label required>Janela entrega — Data Fim</Label>
        <input
          type="date"
          value={form.delivery_window_end}
          onChange={(e) => update('delivery_window_end', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <FieldError msg={fieldErrors.delivery_window_end} />
      </div>
      <div className="sm:col-span-2 rounded-md border border-info/30 bg-info-light/40 px-3 py-2 text-xs text-text-secondary">
        A janela de entrega deve cobrir a data prevista de descarga no terminal. O time de
        logística ajustará se necessário ao aprovar.
      </div>
      {showLogistics && (
        <>
          <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-text-primary">Dados logísticos</h3>
            <p className="text-xs text-text-tertiary">
              Campos preenchidos pela equipe de logística antes da liberação.
            </p>
          </div>
          <div>
            <Label required>Valor pauta RFL (R$/kg)</Label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={form.rfl_value_kg}
              onChange={(e) => update('rfl_value_kg', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
            <FieldError msg={fieldErrors.rfl_value_kg} />
          </div>
          <div>
            <Label>Valor pauta RFL (R$/saca)</Label>
            <div className="wrap-break-word rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-primary">
              {rflSack}
            </div>
          </div>
          <div>
            <Label required>Vlr frete executado (R$/ton)</Label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.executed_freight_value}
              onChange={(e) => update('executed_freight_value', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
            <FieldError msg={fieldErrors.executed_freight_value} />
          </div>
          <div>
            <Label required>Corredor</Label>
            <select
              value={form.corridor ?? ''}
              onChange={(e) => update('corridor', e.target.value || null)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            >
              <option value="">Selecione…</option>
              {corridors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError msg={fieldErrors.corridor} />
          </div>
          <div>
            <Label required>Agente Frete</Label>
            {isCIF && (
              <>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-primary">
                  {form.freight_agent || (
                    <span className="text-text-tertiary">
                      {billingBranch ? 'Não configurado na filial' : 'Aguardando filial emissora'}
                    </span>
                  )}
                </div>
                <span className="mt-1 block text-xs text-text-tertiary">
                  {billingBranch
                    ? 'Preenchido automaticamente com a transportadora CIF da filial emissora.'
                    : 'Será preenchido ao selecionar a filial emissora (próximo passo).'}
                </span>
              </>
            )}
            {isFOB && (
              <>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-primary">
                  {form.freight_agent || <span className="text-text-tertiary">Aguardando código ponto de coleta</span>}
                </div>
                <span className="mt-1 block text-xs text-text-tertiary">
                  Preenchido automaticamente com o código ponto de coleta.
                </span>
              </>
            )}
            {isCPT && (
              <div className="space-y-2">
                {/* Selected transportadoras list */}
                {form.freight_agents_cpt.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.freight_agents_cpt.map((code, idx) => (
                      <span
                        key={code}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          idx === 0
                            ? 'bg-brand-blue text-white'
                            : 'bg-slate-100 text-text-primary'
                        }`}
                      >
                        {idx === 0 && (
                          <span className="mr-0.5 opacity-75">1º</span>
                        )}
                        {code}
                        <button
                          type="button"
                          onClick={() => {
                            const next = form.freight_agents_cpt.filter((c) => c !== code);
                            update('freight_agents_cpt', next);
                            update('freight_agent', next[0] ?? '');
                          }}
                          className="ml-0.5 rounded-full hover:opacity-75"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {form.freight_agents_cpt.length === 0 && (
                  <p className="text-xs text-text-tertiary">
                    Nenhuma transportadora selecionada. A primeira adicionada será enviada para a planilha.
                  </p>
                )}
                <TransportadoraCombobox
                  value=""
                  onChange={(code) => {
                    if (!code || form.freight_agents_cpt.includes(code)) return;
                    const next = [...form.freight_agents_cpt, code];
                    update('freight_agents_cpt', next);
                    update('freight_agent', next[0]);
                  }}
                  error={fieldErrors.freight_agent}
                  placeholder="Adicionar transportadora…"
                />
              </div>
            )}
            {!isCIF && !isFOB && !isCPT && (
              <input
                type="text"
                value={form.freight_agent}
                onChange={(e) => update('freight_agent', e.target.value)}
                placeholder="Selecione o tipo de frete para preencher"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              />
            )}
            <FieldError msg={fieldErrors.freight_agent} />
          </div>
          <div>
            <Label required>Agendamento</Label>
            <input
              type="text"
              value={form.scheduling}
              onChange={(e) => update('scheduling', e.target.value)}
              placeholder="Ex.: d+1"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
            <FieldError msg={fieldErrors.scheduling} />
          </div>
          <div>
            <Label>Percurso: NI</Label>
            <Toggle value={form.route_info} onChange={(v) => update('route_info', v)} />
            <FieldError msg={fieldErrors.route_info} />
          </div>
        </>
      )}
    </div>
  );
}

function Step4({
  form,
  update,
  fieldErrors,
  participants,
  commercials,
  branches,
  billingLocked,
  notes,
  setNotes,
}: {
  form: FormState;
  update: UpdateFn;
  fieldErrors: Record<string, string>;
  participants: { id: string; name: string; inscricao_estadual: string; cnpj: string }[];
  commercials: { id: string; name: string }[];
  branches: Branch[];
  billingLocked: boolean;
  notes: string;
  setNotes: (v: string) => void;
}) {
  const filteredParticipants = useMemo(() => participants, [participants]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Carga com participante?</Label>
        <Toggle
          value={form.has_participant}
          onChange={(v) => {
            update('has_participant', v);
            if (!v) update('participant', null);
          }}
        />
      </div>

      {form.has_participant && (
        <div className="sm:col-span-2">
          <Label required>Participante</Label>
          <select
            value={form.participant ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              update('participant', id);
              const p = filteredParticipants.find((x) => x.id === id);
              if (p && !form.client_state_registration) {
                update('client_state_registration', p.inscricao_estadual || '');
              }
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          >
            <option value="">Selecione…</option>
            {filteredParticipants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <FieldError msg={fieldErrors.participant} />
        </div>
      )}

      <div className="sm:col-span-2">
        <Label>Produto entregue pelo titular do contrato?</Label>
        <Toggle
          value={form.delivered_by_holder}
          onChange={(v) => update('delivered_by_holder', v)}
        />
      </div>

      <div className="sm:col-span-2">
        <Label required>Nome Produtor Faturamento</Label>
        <ProducerCombobox
          value={form.billing_producer_name}
          onChange={(name) => update('billing_producer_name', name)}
          disabled={form.delivered_by_holder}
          error={fieldErrors.billing_producer_name}
        />
      </div>
      <div>
        <Label>Inscrição Estadual do Cliente</Label>
        <input
          type="text"
          value={form.client_state_registration}
          onChange={(e) => update('client_state_registration', e.target.value)}
          placeholder="Digite a inscrição estadual"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
      </div>

      <div className="sm:col-span-2">
        <Label>CNPJ para faturamento do cliente</Label>
        {billingLocked ? (
          <div className="rounded-md border border-warning/40 bg-warning-light/40 px-3 py-2 text-xs text-text-secondary">
            Esta filial (3517) não pode ser usada para faturamento. Escolha um contrato destinado às
            filiais <strong>3504</strong> ou <strong>3509</strong>.
          </div>
        ) : (
          <input
            type="text"
            value={form.cnpj_billing}
            onChange={(e) => update('cnpj_billing', e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          />
        )}
      </div>

      <div className="sm:col-span-2">
        <Label required>Nome Comercial Responsável</Label>
        <select
          value={form.commercial_responsible ?? ''}
          onChange={(e) => update('commercial_responsible', e.target.value || null)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        >
          <option value="">Selecione…</option>
          {commercials.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <FieldError msg={fieldErrors.commercial_responsible} />
      </div>

      <div className="sm:col-span-2">
        <Label required>Filial Emissora da Ordem</Label>
        {billingLocked && (
          <div className="mb-2 rounded-md border border-warning/40 bg-warning-light/40 px-3 py-2 text-xs text-text-secondary">
            A filial <strong>3517</strong> não pode ser emissora da ordem. Selecione uma das filiais
            do Tocantins disponíveis abaixo (3504, 3509, 3518 ou demais filiais TO).
          </div>
        )}
        <select
          value={form.billing_branch ?? ''}
          onChange={(e) => update('billing_branch', e.target.value || null)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        >
          <option value="">Selecione…</option>
          {(billingLocked
            ? branches.filter((b) => b.state === 'TO' && !/3517/.test(b.sap_code))
            : branches
          ).map((b) => (
            <option key={b.id} value={b.id}>
              {b.sap_code} — {b.description}
            </option>
          ))}
        </select>
        <FieldError msg={fieldErrors.billing_branch} />
      </div>

      <div className="sm:col-span-2">
        <Label>NF Entrega Futura?</Label>
        <Toggle
          value={form.has_nf_future_delivery}
          onChange={(v) => {
            update('has_nf_future_delivery', v);
            if (!v) update('nf_key_future_delivery', '');
          }}
        />
      </div>

      {form.has_nf_future_delivery && (
        <div className="sm:col-span-2">
          <Label>Chave NF Entrega Futura</Label>
          <input
            type="text"
            value={form.nf_key_future_delivery}
            onChange={(e) => update('nf_key_future_delivery', e.target.value)}
            placeholder="Digite a chave da NF"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          />
          <FieldError msg={fieldErrors.nf_key_future_delivery} />
        </div>
      )}

      <div className="sm:col-span-2">
        <Label>Observações (opcional)</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Informações adicionais para o time de logística…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
      </div>
    </div>
  );
}
