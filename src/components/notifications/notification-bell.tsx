"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Camera, CheckSquare, Clapperboard, FileText, Settings2, Sun, TriangleAlert, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { getBellAction, getUnreadCountAction, type BellItem } from "@/lib/actions/push-actions";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notification-actions";

const ICONS: Record<string, typeof Bell> = {
  tarefas: CheckSquare,
  comercial: FileText,
  financeiro: Wallet,
  alertas: TriangleAlert,
  operacao: Camera,
  midia: Clapperboard,
  resumo: Sun,
};

// Notificações antigas não tinham categoria: deduz pelo link.
function iconFor(item: BellItem) {
  if (item.category && ICONS[item.category]) return ICONS[item.category];
  const l = item.link ?? "";
  if (l.startsWith("/tarefas")) return ICONS.tarefas;
  if (l.startsWith("/propostas") || l.startsWith("/comissoes") || l.startsWith("/crm") || l.startsWith("/contratos")) return ICONS.comercial;
  if (l.startsWith("/financeiro")) return ICONS.financeiro;
  if (l.startsWith("/alertas")) return ICONS.alertas;
  if (l.startsWith("/midia")) return ICONS.midia;
  return Bell;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "ontem";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
}

// Sino com as notificações da pessoa. `placement` define para onde o painel abre:
// "sidebar" (desktop, à direita do menu) ou "mobile" (painel largo sob o topo).
export function NotificationBell({ placement }: { placement: "sidebar" | "mobile" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<BellItem[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    getUnreadCountAction().then(setUnread).catch(() => {});
  }, []);

  const load = useCallback(() => {
    getBellAction()
      .then((r) => {
        setUnread(r.unread);
        setItems(r.items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const tick = window.setInterval(() => document.visibilityState === "visible" && refreshCount(), 60_000);
    const onFocus = () => refreshCount();
    const onMessage = (e: MessageEvent) => e.data?.type === "lb-push" && refreshCount();
    window.addEventListener("focus", onFocus);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    load();
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  async function openItem(item: BellItem) {
    setOpen(false);
    if (!item.read) {
      setUnread((n) => Math.max(0, n - 1));
      await markNotificationReadAction(item.id).catch(() => {});
    }
    if (item.link) router.push(item.link);
  }

  async function readAll() {
    setUnread(0);
    setItems((list) => list?.map((i) => ({ ...i, read: true })) ?? null);
    await markAllNotificationsReadAction().catch(() => {});
  }

  return (
    <div ref={ref} className={cn(placement === "sidebar" && "relative")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notificações: ${unread} não lidas` : "Notificações"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-card-elevated hover:text-text-primary"
      >
        <Bell size={17} strokeWidth={1.75} />
        {unread > 0 && (
          <span className="lb-figures absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[image:var(--lh-accent-gradient)] px-1 text-[10px] font-semibold text-accent-on ring-2 ring-card">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "z-50 flex max-h-[min(560px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]",
            placement === "sidebar" ? "absolute left-0 top-full mt-2 w-[380px]" : "fixed inset-x-3 top-[76px]",
          )}
        >
          <div className="flex items-center justify-between px-5 pb-3 pt-4">
            <p className="text-sm font-semibold text-text-primary">Notificações</p>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="text-xs text-accent-light hover:underline">
                Marcar tudo como lido
              </button>
            )}
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
            {items === null ? (
              <p className="px-3 py-8 text-center text-sm text-text-tertiary">Carregando…</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                <Bell size={20} className="text-text-tertiary" />
                <p className="text-sm text-text-secondary">Nada por aqui ainda</p>
                <p className="text-xs text-text-tertiary">Tarefas, orçamentos e alertas aparecem aqui.</p>
              </div>
            ) : (
              items.map((item) => {
                const Icon = iconFor(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className="flex w-full gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-card-elevated"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                        item.read ? "border-border text-text-tertiary" : "border-accent/40 text-accent-light",
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn("text-[13px] leading-snug", item.read ? "text-text-secondary" : "font-semibold text-text-primary")}>{item.title}</span>
                        <span className="shrink-0 pt-0.5 text-[11px] text-text-tertiary">{timeAgo(item.createdAt)}</span>
                      </span>
                      <span className="line-clamp-2 text-xs leading-snug text-text-tertiary">{item.body}</span>
                    </span>
                    {!item.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>
          <Link
            href="/configuracoes/perfil#notificacoes"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-border px-5 py-3 text-xs text-text-secondary hover:text-text-primary"
          >
            <Settings2 size={13} /> Preferências de notificação
          </Link>
        </div>
      )}
    </div>
  );
}
