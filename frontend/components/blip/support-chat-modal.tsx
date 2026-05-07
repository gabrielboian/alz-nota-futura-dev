import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Headset,
  MessageCircleHeart,
  Search,
  X,
} from "lucide-react";
//import type { ClientOption } from "../services/client-service";
import type { ClientOption } from '@/lib/api/client-service';

type SupportChatModalProps = {
  open: boolean;
  onClose: () => void;
  clients: ClientOption[];
  userName: string;
  origin: string;
  onStart?: (client: ClientOption) => void;
};

export function SupportChatModal({
  open,
  onClose,
  clients,
  userName,
  origin,
  onStart,
}: SupportChatModalProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;

    setSelectedClientId(null);
    setSearch("");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return clients.filter((client) =>
      client.name.toLowerCase().includes(normalizedSearch)
    );
  }, [clients, search]);

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null;

  function handleStart() {
    if (!selectedClient) return;
    onStart?.(selectedClient);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="Fechar modal"
        onClick={onClose}
        className="absolute inset-0 bg-[#0f172a]/45 backdrop-blur-[2px]"
      />

      <div
        className="
          relative z-10 flex w-full max-w-[560px] flex-col overflow-hidden
          rounded-[24px] border border-[#e7edf5] bg-white
          shadow-[0_30px_80px_rgba(15,23,42,0.22)]
          max-h-[calc(100dvh-24px)]
          sm:max-h-[calc(100dvh-32px)]
        "
      >
        <div
          className="
            relative shrink-0 border-b border-[#edf2f7]
            bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_100%)]
            px-5 pb-4 pt-5
            sm:px-6 sm:pb-5 sm:pt-6
            max-[700px]:py-4
          "
        >
          <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dbe7f3] bg-white text-[#475569] transition hover:bg-[#f8fafc]"
            >
              <X size={18} />
            </button>
          </div>

          <div
            className="
              mb-3 flex h-12 w-12 items-center justify-center rounded-2xl
              bg-[linear-gradient(135deg,#1f8ded_0%,#0f6fd1_100%)]
              text-white shadow-[0_12px_24px_rgba(15,111,209,0.20)]
              sm:h-14 sm:w-14
              max-[700px]:h-11 max-[700px]:w-11
            "
          >
            <Headset size={24} />
          </div>

          <div className="space-y-2 pr-10">
            <div className="flex items-center gap-2 text-[#0f172a]">
              <MessageCircleHeart size={17} className="text-[#1f8ded]" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#1f8ded] sm:text-[13px]">
                Suporte ALZ Grãos
              </span>
            </div>

            <h2 className="text-[clamp(20px,3.2vh,28px)] font-semibold leading-tight text-[#0f172a]">
              Olá, {userName || "usuário"} que bom ter você aqui.
            </h2>

            <p className="max-w-[430px] text-[clamp(12px,1.8vh,14px)] leading-6 text-[#475569] max-[700px]:leading-5">
              Seja bem-vindo ao suporte da ALZ Grãos. Selecione abaixo a empresa
              sobre a qual deseja falar para iniciar o atendimento.
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <input type="hidden" name="userName" value={userName} />
          <input type="hidden" name="origin" value={origin} />
          <input
            type="hidden"
            name="selectedClient"
            value={selectedClient?.name ?? ""}
          />

          <div className="mb-3 shrink-0">
            <label className="mb-2 block text-[13px] font-semibold text-[#334155] text-justify">
              Selecione abaixo o cliente com o qual está operando no momento. Isso ajudará o time a iniciar seu atendimento com mais agilidade. Em caso de dúvida geral sobre a plataforma ou o processo, selecione qualquer cliente, caso tenha acesso a mais de um.
            </label>

            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]"
              />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar empresa"
                className="h-11 w-full rounded-xl border border-[#dbe2ea] bg-white pl-11 pr-4 text-[14px] text-[#334155] outline-none transition placeholder:text-[#94a3b8] focus:border-[#93c5fd] focus:ring-2 focus:ring-[#dbeafe]"
              />
            </div>
          </div>

          <div
            className="
              min-h-[150px] flex-1 space-y-2 overflow-y-auto rounded-2xl
              border border-[#ebf1f6] bg-[#fbfdff] p-2
            "
          >
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => {
                const isSelected = selectedClientId === client.id;

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition max-[700px]:py-2.5 ${
                      isSelected
                        ? "border-[#bfdbfe] bg-[#eff6ff] shadow-[0_6px_16px_rgba(30,64,175,0.08)]"
                        : "border-transparent bg-white hover:border-[#dbe7f3] hover:bg-[#f8fbff]"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl max-[700px]:h-8 max-[700px]:w-8 ${
                        isSelected
                          ? "bg-[#dbeafe] text-[#1d4ed8]"
                          : "bg-[#eff6ff] text-[#2563eb]"
                      }`}
                    >
                      <Building2 size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-[#0f172a]">
                        {client.name}
                      </div>

                      <div className="mt-1 text-[12px] text-[#64748b]">
                        Atendimento de suporte vinculado a esta empresa
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-[#dbe7f3] bg-white px-4 text-center text-[14px] text-[#64748b]">
                Nenhuma empresa encontrada.
              </div>
            )}
          </div>

          <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-[#edf2f7] pt-4 max-[520px]:flex-col max-[520px]:items-stretch">
            <div className="text-[12px] leading-5 text-[#64748b]">
              Selecione uma empresa para habilitar o início do atendimento.
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={!selectedClient}
              className="h-11 min-w-[120px] rounded-xl bg-[linear-gradient(135deg,#1f8ded_0%,#0f6fd1_100%)] px-5 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(15,111,209,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#cbd5e1] disabled:bg-none disabled:text-white disabled:shadow-none"
            >
              Iniciar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

