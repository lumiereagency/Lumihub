"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallAppPrompt } from "@/components/layout/install-app-prompt";
import { dismissedRecently, needsInstallForPush, pushSupported, registerServiceWorker, rememberDismiss, subscribeThisDevice } from "@/lib/push-client";

// Convites do app num lugar só, um de cada vez: primeiro ativar as
// notificações (quando o aparelho já pode recebê-las), depois instalar.
// Também registra o service worker e, se a pessoa já tinha permitido,
// reinscreve o aparelho em silêncio (troca de conta, chave nova).

const PUSH_DISMISS_KEY = "lb-push-dismissed";

export function AppPrompts({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [push, setPush] = useState<"hidden" | "ask" | "working" | "denied">("hidden");

  useEffect(() => {
    let timer: number | undefined;
    (async () => {
      await registerServiceWorker();
      if (!pushSupported() || needsInstallForPush()) return;
      if (Notification.permission === "granted") {
        await subscribeThisDevice(vapidPublicKey).catch(() => {});
      } else if (Notification.permission === "default" && !dismissedRecently(PUSH_DISMISS_KEY, 7)) {
        timer = window.setTimeout(() => setPush("ask"), 1500);
      }
    })();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [vapidPublicKey]);

  async function enable() {
    setPush("working");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPush("denied");
      rememberDismiss(PUSH_DISMISS_KEY);
      return;
    }
    await subscribeThisDevice(vapidPublicKey).catch(() => {});
    setPush("hidden");
  }

  function dismiss() {
    rememberDismiss(PUSH_DISMISS_KEY);
    setPush("hidden");
  }

  return (
    <>
      {push !== "hidden" && (
        <div role="dialog" aria-label="Ativar notificações" className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]">
          <div className="relative flex gap-3.5 rounded-3xl border border-border bg-card p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
            <button
              type="button"
              onClick={dismiss}
              aria-label="Fechar"
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
            >
              <X size={15} />
            </button>
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[image:var(--lh-accent-gradient)] text-accent-on">
              <BellRing size={22} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
              <p className="text-sm font-semibold text-text-primary">Ative as notificações</p>
              {push === "denied" ? (
                <p className="text-[13px] leading-snug text-text-tertiary">
                  O navegador bloqueou. Para liberar, toque no cadeado ao lado do endereço e permita notificações. Depois, ative em Meu perfil.
                </p>
              ) : (
                <>
                  <p className="text-[13px] leading-snug text-text-tertiary">
                    Tarefas, orçamentos, contas e alertas chegam neste aparelho mesmo com a base fechada.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="accent" onClick={enable} disabled={push === "working"}>
                      {push === "working" ? "Ativando…" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={dismiss}>
                      Agora não
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <InstallAppPrompt hidden={push !== "hidden"} />
    </>
  );
}
