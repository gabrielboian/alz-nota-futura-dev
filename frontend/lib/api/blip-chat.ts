import { useCallback, useEffect, useRef } from "react";

export type BlipChatBuilder = {
  withAppKey: (value: string) => BlipChatBuilder;
  withButton: (value: { color: string; icon?: string }) => BlipChatBuilder;
  withCustomCommonUrl: (value: string) => BlipChatBuilder;
  withCustomSearchParams: (value: Record<string, string>) => BlipChatBuilder;
  withEventHandler: (event: string, callback: () => void) => BlipChatBuilder;
  sendMessage?: (message: {
    type: string;
    content: string;
    metadata?: Record<string, string>;
  }) => void;
  destroy?: () => void;
  build: () => BlipChatBuilder | void;
};

export type WindowWithBlip = typeof window & {
  BlipChat?: {
    new (): BlipChatBuilder;
    LOAD_EVENT: string;
  };
};

export type ChatContext = {
  origin?: string;
  userName?: string;
  selectedClient?: {
    id?: string | number;
    name?: string;
  };
};

export const BLIP_SCRIPT_SRC = "https://unpkg.com/blip-chat-widget";

export const BLIP_APP_KEY = "YWx6Z3Jhb3NwcmQ6OGQ1ZDQxYzItMmExMS00N2I5LWIzM2UtZDRjN2Q1ODY4OTE1";

export const BLIP_COMMON_URL = "https://alzgraos.chat.blip.ai/";

export const INITIAL_MESSAGE = "Quero suporte para o sistema CIF Tegram.";

export const STORAGE_STARTED = "blipSupportStarted";
export const STORAGE_CONTEXT = "blipSupportContext";
export const STORAGE_INITIAL_MESSAGE_SENT = "blipInitialMessageSent";
export const STORAGE_CHAT_SESSION_ID = "blipChatSessionId";

export function getSavedContext(): ChatContext {
  try {
    const raw = localStorage.getItem(STORAGE_CONTEXT);

    if (!raw) {
      return {
        origin: "Site-cifporto",
        userName: "",
        selectedClient: {
          id: "",
          name: "",
        },
      };
    }

    return JSON.parse(raw) as ChatContext;
  } catch {
    return {
      origin: "Site-cifporto",
      userName: "",
      selectedClient: {
        id: "",
        name: "",
      },
    };
  }
}

export function useBlipChat() {
  const blipRef = useRef<BlipChatBuilder | null>(null);
  const scriptLoadedRef = useRef(false);
  const blipBuiltRef = useRef(false);

  const loadBlipScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      const blipWindow = window as WindowWithBlip;

      if (blipWindow.BlipChat || scriptLoadedRef.current) {
        scriptLoadedRef.current = true;
        resolve();
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${BLIP_SCRIPT_SRC}"]`
      );

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          () => {
            scriptLoadedRef.current = true;
            resolve();
          },
          { once: true }
        );

        existingScript.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = BLIP_SCRIPT_SRC;
      script.type = "text/javascript";
      script.async = true;

      script.onload = () => {
        scriptLoadedRef.current = true;
        resolve();
      };

      script.onerror = () => {
        reject(new Error("Erro ao carregar o script do Blip Chat."));
      };

      document.body.appendChild(script);
    });
  }, []);

  const clickNativeBlipButton = useCallback(() => {
    const blipButton = document.querySelector(
      "#blip-chat-open-iframe"
    ) as HTMLElement | null;

    blipButton?.click();
  }, []);

  const sendInitialMessageOnce = useCallback(
    (blip: BlipChatBuilder, context: ChatContext) => {
      const alreadySent =
        sessionStorage.getItem(STORAGE_INITIAL_MESSAGE_SENT) === "true";

      if (alreadySent) return;

      if (typeof blip.sendMessage !== "function") {
        console.warn("sendMessage ainda não está disponível no Blip.");
        return;
      }

      if (!context) {
        console.warn(
          "Contexto do chat ainda não definido. Mensagem inicial não enviada."
        );
        return;
      }

      const chatSessionId = localStorage.getItem(STORAGE_CHAT_SESSION_ID) ?? "";

      const metadata = {
        origin: String(context.origin ?? "Site-cifporto"),
        userName: String(context.userName ?? ""),
        clientId: String(context.selectedClient?.id ?? ""),
        clientName: String(context.selectedClient?.name ?? ""),
        chatSessionId,
      };

      blip.sendMessage({
        type: "text/plain",
        content: INITIAL_MESSAGE,
        metadata,
      });

      sessionStorage.setItem(STORAGE_INITIAL_MESSAGE_SENT, "true");
      console.log("Mensagem inicial enviada para o Blip.");
      console.log("Metadata enviada para o Blip:", metadata);
    },
    []
  );

  const buildBlipChat = useCallback(
    async (context: ChatContext) => {
      await loadBlipScript();

      const blipWindow = window as WindowWithBlip;

      if (!blipWindow.BlipChat) {
        console.error("BlipChat não foi encontrado após carregar o script.");
        return;
      }

      if (blipBuiltRef.current) return;

      const chatSessionId =
        localStorage.getItem(STORAGE_CHAT_SESSION_ID) ||
        (typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
            }));

      localStorage.setItem(STORAGE_CHAT_SESSION_ID, chatSessionId);

      const backgroundParams = {
        origin: String(context.origin ?? "Site-cifporto"),
        userName: String(context.userName ?? ""),
        clientId: String(context.selectedClient?.id ?? ""),
        clientName: String(context.selectedClient?.name ?? ""),
        chatSessionId,
      };

      const blip = new blipWindow.BlipChat()
        .withAppKey(BLIP_APP_KEY)
        .withButton({ color: "#003865" })
        .withCustomCommonUrl(BLIP_COMMON_URL)
        .withCustomSearchParams(backgroundParams)
        .withEventHandler("OnLoad", () => {
          sendInitialMessageOnce(blip, context);
        })
        .withEventHandler("OnLeave", () => {
          console.log("[BLIP] Chat fechado.");
        });

      const builtBlip = blip.build();

      blipRef.current = builtBlip || blip;
      blipBuiltRef.current = true;

      console.log("Dados invisíveis enviados para o Blip:", backgroundParams);
    },
    [loadBlipScript, sendInitialMessageOnce]
  );

  const startBlipChat = useCallback(
    async (context: ChatContext) => {
      sessionStorage.removeItem(STORAGE_INITIAL_MESSAGE_SENT);

      await buildBlipChat(context);

      window.setTimeout(() => {
        clickNativeBlipButton();
      }, 900);
    },
    [buildBlipChat, clickNativeBlipButton]
  );

  const restoreBlipChat = useCallback(
    async (context: ChatContext) => {
      await buildBlipChat(context);
    },
    [buildBlipChat]
  );

  useEffect(() => {
    return () => {
      blipRef.current?.destroy?.();
      blipRef.current = null;
      blipBuiltRef.current = false;
    };
  }, []);

  return {
    startBlipChat,
    restoreBlipChat,
    clickNativeBlipButton,
  };
}
