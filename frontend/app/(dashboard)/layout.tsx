'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { DashboardPageGuard } from '@/components/auth/dashboard-page-guard';

// BLIP - botão e controle do chat
import { SupportChatButton } from '@/components/blip/support-chat-button';
import {
  useBlipChat,
  getSavedContext,
  STORAGE_STARTED,
  STORAGE_CONTEXT,
  STORAGE_CHAT_SESSION_ID,
  type ChatContext,
} from '@/lib/api/blip-chat';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

    // BLIP - funções principais do widget
  const { startBlipChat, restoreBlipChat, clickNativeBlipButton } =
    useBlipChat();

  // BLIP - controla se o atendimento já foi iniciado
  const [supportStarted, setSupportStarted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_STARTED) === 'true';
  });

  // BLIP - evita restaurar o chat mais de uma vez
  const restoredRef = useRef(false);

  // BLIP - adiciona/remove classe no body quando o suporte está ativo
  useEffect(() => {
    document.body.classList.toggle('blip-support-started', supportStarted);
  }, [supportStarted]);

  // BLIP - restaura o chat se já existir atendimento iniciado no localStorage
  useEffect(() => {
    if (!isAuthenticated) return;
    if (restoredRef.current) return;
    restoredRef.current = true;

    const alreadyStarted = localStorage.getItem(STORAGE_STARTED) === 'true';

    if (!alreadyStarted) return;

    setSupportStarted(true);
    restoreBlipChat(getSavedContext());
  }, [isAuthenticated, restoreBlipChat]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-special-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative">
        <div className='absolute right-[30%] top-3'>
          {/* BLIP - botão de atendimento */}
          <SupportChatButton
            origin="Site-cifporto"
            supportStarted={supportStarted}
            onOpenExistingChat={clickNativeBlipButton}
            onStartSupport={async (data) => {
              const context: ChatContext = {
                origin: data.origin,
                userName: data.userName,
                selectedClient: data.selectedClient,
              };

              localStorage.removeItem(STORAGE_CHAT_SESSION_ID);
              localStorage.setItem(STORAGE_STARTED, 'true');
              localStorage.setItem(STORAGE_CONTEXT, JSON.stringify(context));

              setSupportStarted(true);

              await startBlipChat(context);
            }}
          />
        </div>
        <DashboardPageGuard>{children}</DashboardPageGuard>
      </main>
    </div>
  );
}
