import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Target,
  FileSignature,
  Users,
  FileText,
  FolderKanban,
  ListChecks,
  Camera,
  Calendar,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Send,
  CreditCard,
  TrendingUp,
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
} from "lucide-react";
import { permKey } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string | null;
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

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: permKey("DASHBOARD", "VIEW") }],
  },
  {
    label: "Comercial",
    items: [
      { label: "CRM", href: "/crm", icon: Target, permission: permKey("CRM", "VIEW") },
      { label: "Propostas", href: "/propostas", icon: FileSignature, permission: permKey("CRM", "VIEW") },
    ],
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
      { label: "Tarefas", href: "/tarefas", icon: ListChecks, permission: permKey("TASKS", "VIEW") },
      { label: "Captações", href: "/captacoes", icon: Camera, permission: permKey("CAPTURES", "VIEW") },
      { label: "Agenda", href: "/agenda", icon: Calendar, permission: permKey("CALENDAR", "VIEW") },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Visão Financeira", href: "/financeiro", icon: Wallet, permission: permKey("FINANCE", "VIEW") },
      { label: "Contas a Receber", href: "/financeiro/receber", icon: ArrowDownCircle, permission: permKey("RECEIVABLES", "VIEW") },
      { label: "Cobranças", href: "/financeiro/cobrancas", icon: Send, permission: permKey("RECEIVABLES", "VIEW") },
      { label: "Contas a Pagar", href: "/financeiro/pagar", icon: ArrowUpCircle, permission: permKey("PAYABLES", "VIEW") },
      { label: "Cartões", href: "/financeiro/cartoes", icon: CreditCard, permission: permKey("CARDS", "VIEW") },
      { label: "Fluxo de Caixa", href: "/financeiro/fluxo-de-caixa", icon: TrendingUp, permission: permKey("FINANCE", "VIEW") },
      { label: "Investimentos", href: "/financeiro/investimentos", icon: Landmark, permission: permKey("INVESTMENTS", "VIEW") },
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
    label: "Configurações",
    items: [
      { label: "Perfil", href: "/configuracoes/perfil", icon: UserCircle, permission: null },
      { label: "Usuários", href: "/configuracoes/usuarios", icon: Shield, permission: permKey("USERS", "VIEW") },
      { label: "Integrações", href: "/configuracoes/integracoes", icon: Plug, permission: permKey("INTEGRATIONS", "VIEW") },
      { label: "Configurações", href: "/configuracoes", icon: Settings, permission: permKey("SETTINGS", "VIEW") },
    ],
  },
];
