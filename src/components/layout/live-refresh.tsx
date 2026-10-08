"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Mantém a tela com os dados mais recentes: ao voltar para a aba/janela (ou
// para o app no celular) a página é recarregada do servidor; nas telas de
// números (dashboard e financeiro) também a cada minuto enquanto aberta.
// Assim uma alteração feita em outra aba aparece sem precisar dar F5.
const LIVE_PATHS = ["/dashboard", "/financeiro", "/equipe/pagamentos"];

export function LiveRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const last = useRef(0);

  useEffect(() => {
    last.current = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      // Não atrapalha quem está digitando num formulário.
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (Date.now() - last.current < 10_000) return;
      last.current = Date.now();
      router.refresh();
    };
    const onVisible = () => refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const live = LIVE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    const timer = live ? window.setInterval(refresh, 60_000) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (timer) window.clearInterval(timer);
    };
  }, [router, pathname]);

  return null;
}
