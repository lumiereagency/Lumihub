import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, CalendarDays, CalendarClock, Bell, MessageSquareText, UserCircle, Clock } from "lucide-react";
import { MEDIA_PORTAL_TEAM_VIEW } from "@/lib/auth/permissions";

export interface MediaPortalNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string | null;
}

export const MEDIA_PORTAL_NAV: MediaPortalNavItem[] = [
  { label: "Início", href: "/midia/inicio", icon: LayoutDashboard, permission: null },
  { label: "Minha Escala", href: "/midia/minha-escala", icon: CalendarClock, permission: null },
  { label: "Calendário", href: "/midia/calendario", icon: CalendarDays, permission: null },
  { label: "Equipe", href: "/midia/equipe", icon: Users, permission: MEDIA_PORTAL_TEAM_VIEW },
  { label: "Disponibilidade", href: "/midia/disponibilidade", icon: Clock, permission: null },
  { label: "Solicitações", href: "/midia/solicitacoes", icon: MessageSquareText, permission: null },
  { label: "Notificações", href: "/midia/notificacoes", icon: Bell, permission: null },
  { label: "Meu Perfil", href: "/midia/perfil", icon: UserCircle, permission: null },
];

export function getActiveMediaHref(pathname: string, items: MediaPortalNavItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}
