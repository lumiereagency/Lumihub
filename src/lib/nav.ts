import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Target,
  Users,
  FileText,
  FolderKanban,
  Camera,
  Calendar,
  Wallet,
  Send,
  Landmark,
  UserSquare2,
  Sparkles,
  Lightbulb,
  BellRing,
  Flag,
  BarChart3,
  FolderOpen,
  Plug,
  Shield,
  Settings,
  UserCircle,
  Clapperboard,
  CalendarClock,
} from "lucide-react";
import { permKey } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  // Array = visível se o usuário tiver QUALQUER uma das permissões (§
  // itens de menu que agora agrupam páginas com permissões distintas —
  // ex: "Financeiro" cobre Visão Geral/Receber/Cobranças/Pagar, cada uma
  // com sua própria permissão granular).
  permission: string | string[] | null;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Encontra o item de navegação "ativo" para o pathname atual usando o prefixo
// mais longo que combina — evita que rotas aninhadas (ex: /configuracoes/perfil)
// marquem como ativos tanto "Perfil" quanto "Configurações" ao mesmo tempo.
export function getActiveHref(pathname: string, groups: NavGroup[]): string | null {
  let best: string | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && (!best || item.href.length > best.length)) {
        best = item.href;
      }
    }
  }
  return best;
}

export interface NavTab {
  label: string;
  href: string;
  permission?: string | string[] | null;
}

// Filtra as abas de uma página agrupada (§ CRM+Propostas, Projetos+Tarefas,
// os dois blocos do Financeiro) pelas permissões reais do usuário — evita
// mostrar uma aba que leva a uma página onde ele bateria em "acesso negado".
// Recebe o Set de permissões que cada Server Component já tem em `user.permissions`.
export function filterTabsForUser(tabs: NavTab[], permissions: Set<string>): { label: string; href: string }[] {
  return tabs
    .filter((tab) => {
      if (!tab.permission) return true;
      const required = Array.isArray(tab.permission) ? tab.permission : [tab.permission];
      return required.some((p) => permissions.has(p));
    })
    .map(({ label, href }) => ({ label, href }));
}

export const CRM_TABS: NavTab[] = [
  { label: "Funil", href: "/crm", permission: permKey("CRM", "VIEW") },
  { label: "Propostas", href: "/propostas", permission: permKey("CRM", "VIEW") },
];

export const PROJECT_TABS: NavTab[] = [
  { label: "Projetos", href: "/projetos", permission: permKey("PROJECTS", "VIEW") },
  { label: "Tarefas", href: "/tarefas", permission: permKey("TASKS", "VIEW") },
];

export const FINANCE_TABS: NavTab[] = [
  { label: "Visão Geral", href: "/financeiro", permission: permKey("FINANCE", "VIEW") },
  { label: "Contas a Receber", href: "/financeiro/receber", permission: permKey("RECEIVABLES", "VIEW") },
  { label: "Cobranças", href: "/financeiro/cobrancas", permission: permKey("RECEIVABLES", "VIEW") },
  { label: "Contas a Pagar", href: "/financeiro/pagar", permission: permKey("PAYABLES", "VIEW") },
];

export const ASSETS_TABS: NavTab[] = [
  { label: "Cartões", href: "/financeiro/cartoes", permission: permKey("CARDS", "VIEW") },
  { label: "Fluxo de Caixa", href: "/financeiro/fluxo-de-caixa", permission: permKey("FINANCE", "VIEW") },
  { label: "Investimentos", href: "/financeiro/investimentos", permission: permKey("INVESTMENTS", "VIEW") },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: permKey("DASHBOARD", "VIEW") }],
  },
  {
    label: "Comercial",
    items: [{ label: "CRM", href: "/crm", icon: Target, permission: permKey("CRM", "VIEW") }],
  },
  {
    label: "Clientes",
    items: [
      { label: "Clientes", href: "/clientes", icon: Users, permission: permKey("CLIENTS", "VIEW") },
      { label: "Contratos", href: "/contratos", icon: FileText, permission: permKey("CONTRACTS", "VIEW") },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Projetos", href: "/projetos", icon: FolderKanban, permission: permKey("PROJECTS", "VIEW") },
      { label: "Captações", href: "/captacoes", icon: Camera, permission: permKey("CAPTURES", "VIEW") },
      { label: "Agenda", href: "/agenda", icon: Calendar, permission: permKey("CALENDAR", "VIEW") },
    ],
  },
  {
    label: "Financeiro",
    items: [
      {
        label: "Financeiro",
        href: "/financeiro",
        icon: Wallet,
        permission: [permKey("FINANCE", "VIEW"), permKey("RECEIVABLES", "VIEW"), permKey("PAYABLES", "VIEW")],
      },
      {
        label: "Patrimônio",
        href: "/financeiro/cartoes",
        icon: Landmark,
        permission: [permKey("CARDS", "VIEW"), permKey("INVESTMENTS", "VIEW"), permKey("FINANCE", "VIEW")],
      },
    ],
  },
  {
    label: "Equipe",
    items: [
      { label: "Funcionários", href: "/equipe", icon: UserSquare2, permission: permKey("TEAM", "VIEW") },
      { label: "Freelancers", href: "/equipe/freelancers", icon: UserSquare2, permission: permKey("TEAM", "VIEW") },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { label: "Lumi AI", href: "/ai", icon: Sparkles, permission: permKey("AI", "VIEW") },
      { label: "Insights", href: "/insights", icon: Lightbulb, permission: permKey("AI", "VIEW") },
      { label: "Alertas", href: "/alertas", icon: BellRing, permission: permKey("ALERTS", "VIEW") },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Metas", href: "/metas", icon: Flag, permission: permKey("GOALS", "VIEW") },
      { label: "Relatórios", href: "/relatorios", icon: BarChart3, permission: permKey("REPORTS", "VIEW") },
      { label: "Documentos", href: "/documentos", icon: FolderOpen, permission: permKey("DOCUMENTS", "VIEW") },
    ],
  },
  {
    label: "Mídia ADESF",
    items: [
      { label: "Dashboard", href: "/midia-adesf", icon: Clapperboard, permission: permKey("MEDIA_ADESF", "VIEW") },
      { label: "Escalas", href: "/midia-adesf/escalas", icon: CalendarClock, permission: permKey("MEDIA_ADESF", "VIEW") },
      { label: "Cultos", href: "/midia-adesf/cultos", icon: Calendar, permission: permKey("MEDIA_ADESF", "VIEW") },
      { label: "Calendário", href: "/midia-adesf/calendario", icon: Calendar, permission: permKey("MEDIA_ADESF", "VIEW") },
      { label: "Equipe", href: "/midia-adesf/equipe", icon: Users, permission: permKey("MEDIA_ADESF", "VIEW") },
      { label: "Solicitações", href: "/midia-adesf/solicitacoes", icon: Send, permission: permKey("MEDIA_ADESF", "VIEW") },
      { label: "Histórico", href: "/midia-adesf/historico", icon: FileText, permission: permKey("MEDIA_ADESF", "VIEW") },
      { label: "Relatórios", href: "/midia-adesf/relatorios", icon: BarChart3, permission: permKey("MEDIA_ADESF", "MANAGE") },
      { label: "Configurações", href: "/midia-adesf/configuracoes", icon: Settings, permission: permKey("MEDIA_ADESF", "MANAGE") },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Perfil", href: "/configuracoes/perfil", icon: UserCircle, permission: null },
      { label: "Usuários", href: "/configuracoes/usuarios", icon: Shield, permission: permKey("USERS", "VIEW") },
      { label: "Integrações", href: "/configuracoes/integracoes", icon: Plug, permission: permKey("INTEGRATIONS", "VIEW") },
      { label: "Configurações", href: "/configuracoes", icon: Settings, permission: permKey("SETTINGS", "VIEW") },
    ],
  },
];
