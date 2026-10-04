"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Convite para instalar a LUMIBASE como app. Chrome/Edge (Android e
// computador) entregam o evento `beforeinstallprompt` e instalamos com um
// toque; no iPhone/iPad não existe esse evento, então mostramos o caminho
// pelo botão Compartilhar do Safari. Some quando já está instalada e, se a
// pessoa disser "Agora não", volta só depois de 14 dias.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "lb-install-dismissed";
const DISMISS_DAYS = 14;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function InstallAppPrompt({ hidden = false }: { hidden?: boolean }) {
  const [mode, setMode] = useState<"hidden" | "native" | "ios">("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("native");
    }
    function onInstalled() {
      setMode("hidden");
      setDeferred(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Espera a página assentar antes de aparecer no iPhone.
    const timer = isIos() ? window.setTimeout(() => setMode((m) => (m === "hidden" ? "ios" : m)), 2500) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setMode("hidden");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setMode("hidden");
    else dismiss();
  }

  if (mode === "hidden" || hidden) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar a LUMIBASE"
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]"
    >
      <div className="relative flex gap-3.5 rounded-3xl border border-border bg-card p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
        >
          <X size={15} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png?v=3" alt="" width={52} height={52} className="h-[52px] w-[52px] shrink-0 rounded-[14px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
          <p className="text-sm font-semibold text-text-primary">Instale a LUMIBASE</p>
          {mode === "native" ? (
            <>
              <p className="text-[13px] leading-snug text-text-tertiary">Abra direto da tela inicial ou da barra de tarefas, como um app, sem procurar a aba.</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="accent" onClick={install}>
                  Instalar app
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  Agora não
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-snug text-text-tertiary">Tenha a base na tela inicial do iPhone, como um app, e receba as notificações.</p>
              <ol className="mt-2 flex flex-col gap-1.5 text-[13px] text-text-secondary">
                <li className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card-elevated text-text-primary">
                    <Share size={13} />
                  </span>
                  Toque em Compartilhar, no Safari
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card-elevated text-text-primary">
                    <SquarePlus size={13} />
                  </span>
                  Escolha “Adicionar à Tela de Início”
                </li>
              </ol>
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={dismiss}>
                  Entendi
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
