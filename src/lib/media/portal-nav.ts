import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, CalendarDays, CalendarClock, Bell, MessageSquareText, UserCircle, Settings } from "lucide-react";
import { permKey } from "@/lib/auth/permissions";

export interface MediaPortalNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string | null;
}

// Ordem e rotas seguem a especificação (§6 e §34) — Equipe é visível a
// todo membro (MEMBRO também "pode visualizar equipe", só com redação de
// privacidade — ver §13/§36); só "Configurações" é exclusiva de LÍDER,
// já que envolve gerenciar funções e identidade visual (§13/§39).
export const MEDIA_PORTAL_NAV: MediaPortalNavItem[] = [
  { label: "Início", href: "/midia/inicio", icon: LayoutDashboard, permission: null },
  { label: "Minha Escala", href: "/midia/minha-escala", icon: CalendarClock, permission: null },
  { label: "Escala Geral", href: "/midia/escala", icon: CalendarClock, permission: null },
  { label: "Calendário", href: "/midia/calendario", icon: CalendarDays, permission: null },
  { label: "Equipe", href: "/midia/equipe", icon: Users, permission: null },
  { label: "Solicitações", href: "/midia/solicitacoes", icon: MessageSquareText, permission: null },
  { label: "Notificações", href: "/midia/notificacoes", icon: Bell, permission: null },
  { label: "Meu Perfil", href: "/midia/perfil", icon: UserCircle, permission: null },
  { label: "Configurações", href: "/midia/configuracoes", icon: Settings, permission: permKey("MEDIA_ADESF", "MANAGE") },
];

export function getActiveMediaHref(pathname: string, items: MediaPortalNavItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}
