import { useEffect, useMemo, useState } from "react";
import { Headset, Loader2, MessageCircleMore } from "lucide-react";
import { SupportChatModal } from "./support-chat-modal";
//import { getClientData, type ClientOption } from "./client-service";

import { getClientData, type ClientOption } from '@/lib/api/client-service';

type SupportChatButtonProps = {
  origin?: string;
  buttonLabel?: string;
  supportStarted?: boolean;
  onOpenExistingChat?: () => void;
  onStartSupport?: (data: {
    origin: string;
    userName: string;
    selectedClient: ClientOption;
  }) => void;
};

export function SupportChatButton({
  origin = "Site-cifporto",
  buttonLabel = "Canal de atendimento",
  supportStarted = false,
  onOpenExistingChat,
  onStartSupport,
}: SupportChatButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);

        const response = await getClientData();

        if (!mounted) return;

        setUserName(response.user.name);
        setClients(response.clients);
      } catch (error) {
        console.error("Erro ao carregar dados do canal de atendimento:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const supportClients = useMemo(() => {
    return clients.filter((client) => client.id !== "all");
  }, [clients]);

  function handleClick() {
    const alreadyStarted =
      supportStarted || localStorage.getItem("blipSupportStarted") === "true";

    if (alreadyStarted) {
      onOpenExistingChat?.();
      return;
    }

    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading && !supportStarted}
        className="
          group
          inline-flex h-14 w-[235px] items-center gap-3
          rounded-xl border border-[#d7e7fb]
          bg-white px-4
          text-[#0f172a]
          shadow-[0_8px_24px_rgba(15,23,42,0.06)]
          transition-all duration-200
          hover:-translate-y-[1px]
          hover:border-[#bfdcff]
          hover:shadow-[0_12px_30px_rgba(15,23,42,0.10)]
          focus:outline-none
          focus:ring-2
          focus:ring-[#93c5fd]
          focus:ring-offset-2
          disabled:cursor-not-allowed
          disabled:opacity-70
          disabled:hover:translate-y-0
        "
      >
        <div
          className="
            flex h-8 w-8 items-center justify-center
            rounded-lg
            bg-[linear-gradient(135deg,#1f8ded_0%,#0f6fd1_100%)]
            text-white
            shadow-[0_8px_18px_rgba(15,111,209,0.22)]
          "
        >
          {loading && !supportStarted ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <MessageCircleMore
              size={16}
              className="transition-transform duration-200 group-hover:scale-105"
            />
          )}
        </div>

        <div className="flex flex-col items-start leading-tight">
          <span className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3b82f6]">
            Suporte
          </span>

          <span className="text-left text-[13px] font-semibold text-[#0f172a] whitespace-nowrap">
            Canal de atendimento
          </span>
        </div>

        <Headset
          size={15}
          className="ml-1 text-[#94a3b8] transition-colors group-hover:text-[#3b82f6]"
        />
      </button>

      <SupportChatModal
        open={open}
        onClose={() => setOpen(false)}
        clients={supportClients}
        userName={userName}
        origin={origin}
        onStart={(selectedClient) => {
          onStartSupport?.({
            origin,
            userName,
            selectedClient,
          });

          setOpen(false);
        }}
      />
    </>
  );
}
