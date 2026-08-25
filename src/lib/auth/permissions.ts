import type { RoleKey } from "@/generated/prisma/enums";

// Catálogo de módulos do LUMIBASE. Cada módulo recebe permissões granulares
// no formato `<MODULO>_<ACAO>` (ex: FINANCE_VIEW, MANAGE_INTEGRATIONS).
export const MODULES = [
  "DASHBOARD",
  "CRM",
  "CLIENTS",
  "CONTRACTS",
  "PROJECTS",
  "TASKS",
  "TEAM",
  "CAPTURES",
  "CALENDAR",
  "FINANCE",
  "RECEIVABLES",
  "PAYABLES",
  "CARDS",
  "INVESTMENTS",
  "GOALS",
  "DOCUMENTS",
  "AI",
  "ALERTS",
  "REPORTS",
  "INTEGRATIONS",
  "USERS",
  "SETTINGS",
  "MEDIA_ADESF",
] as const;

export type Module = (typeof MODULES)[number];

export const ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "MANAGE"] as const;
export type Action = (typeof ACTIONS)[number];

export function permKey(module: Module, action: Action): string {
  return `${module}_${action}`;
}

export const MODULE_LABELS: Record<Module, string> = {
  DASHBOARD: "Dashboard",
  CRM: "CRM e Prospecção",
  CLIENTS: "Clientes",
  CONTRACTS: "Contratos",
  PROJECTS: "Projetos",
  TASKS: "Tarefas",
  TEAM: "Equipe",
  CAPTURES: "Captações",
  CALENDAR: "Agenda",
  FINANCE: "Financeiro",
  RECEIVABLES: "Contas a Receber",
  PAYABLES: "Contas a Pagar",
  CARDS: "Cartões",
  INVESTMENTS: "Investimentos",
  GOALS: "Metas",
  DOCUMENTS: "Documentos",
  AI: "Lumi AI",
  ALERTS: "Alertas",
  REPORTS: "Relatórios",
  INTEGRATIONS: "Integrações",
  USERS: "Usuários",
  SETTINGS: "Configurações",
  MEDIA_ADESF: "Mídia ADESF",
};

export const ACTION_LABELS: Record<Action, string> = {
  VIEW: "Visualizar",
  CREATE: "Criar",
  EDIT: "Editar",
  DELETE: "Excluir",
  EXPORT: "Exportar",
  MANAGE: "Gerenciar",
};

export interface PermissionDef {
  key: string;
  module: Module;
  action: Action;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDef[] = MODULES.flatMap((module) =>
  ACTIONS.map((action) => ({
    key: permKey(module, action),
    module,
    action,
    description: `${ACTION_LABELS[action]} em ${MODULE_LABELS[module]}`,
  })),
);

// Aliases usados na especificação (ex: MANAGE_INTEGRATIONS, VIEW_INTEGRATIONS)
export const MANAGE_INTEGRATIONS = permKey("INTEGRATIONS", "MANAGE");
export const VIEW_INTEGRATIONS = permKey("INTEGRATIONS", "VIEW");

function grant(module: Module, actions: Action[]): string[] {
  return actions.map((a) => permKey(module, a));
}

const FULL: Action[] = ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "MANAGE"];
const RW: Action[] = ["VIEW", "CREATE", "EDIT"];
const RO: Action[] = ["VIEW"];
const RO_EXPORT: Action[] = ["VIEW", "EXPORT"];

// Permissões padrão por perfil (Fase 1.4). ADMIN sempre recebe tudo.
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<RoleKey, "CUSTOM">, string[]> = {
  ADMIN: ALL_PERMISSIONS.map((p) => p.key),

  FINANCEIRO: [
    ...grant("DASHBOARD", RO),
    ...grant("FINANCE", FULL),
    ...grant("RECEIVABLES", FULL),
    ...grant("PAYABLES", FULL),
    ...grant("CARDS", FULL),
    ...grant("INVESTMENTS", FULL),
    ...grant("GOALS", RO),
    ...grant("CLIENTS", RO),
    ...grant("CONTRACTS", RW),
    ...grant("ALERTS", RO),
    ...grant("REPORTS", RO_EXPORT),
    ...grant("DOCUMENTS", RW),
  ],

  OPERACAO: [
    ...grant("DASHBOARD", RO),
    ...grant("PROJECTS", RW),
    ...grant("TASKS", FULL),
    ...grant("CALENDAR", FULL),
    ...grant("CAPTURES", FULL),
    ...grant("CLIENTS", RO),
    ...grant("TEAM", RW),
    ...grant("ALERTS", RO),
    ...grant("DOCUMENTS", RW),
  ],

  COMERCIAL: [
    ...grant("DASHBOARD", RO),
    ...grant("CRM", FULL),
    ...grant("CLIENTS", RW),
    ...grant("CONTRACTS", RW),
    ...grant("CALENDAR", RW),
    ...grant("ALERTS", RO),
    ...grant("DOCUMENTS", RW),
  ],

  GESTAO: [
    ...grant("DASHBOARD", RO),
    ...grant("CRM", RO),
    ...grant("CLIENTS", RO),
    ...grant("CONTRACTS", RO),
    ...grant("PROJECTS", RO),
    ...grant("TASKS", RO),
    ...grant("TEAM", RO),
    ...grant("CAPTURES", RO),
    ...grant("CALENDAR", RO),
    ...grant("FINANCE", RO),
    ...grant("RECEIVABLES", RO),
    ...grant("PAYABLES", RO),
    ...grant("CARDS", RO),
    ...grant("INVESTMENTS", RO),
    ...grant("GOALS", FULL),
    ...grant("ALERTS", RO),
    ...grant("REPORTS", RO_EXPORT),
    ...grant("DOCUMENTS", RO),
    ...grant("AI", RO),
  ],
};

// Acesso ao Portal Mídia ADESF (equipe de mídia da igreja) NÃO passa pelo
// catálogo de Role/RolePermission acima — esse catálogo continua reservado
// ao acesso administrativo/gerencial do LUMIBASE (módulo MEDIA_ADESF, para
// quem gerencia o time). O acesso do próprio membro de mídia ao seu portal
// (`/midia/*`) é aditivo: derivado do registro `MediaMember` do usuário e
// unido ao conjunto de permissões da sessão em `getCurrentUser()`, sem
// sobrepor o `roleId` (Fase 46 do módulo — ver ARCHITECTURE.md / spec).
export const MEDIA_PORTAL_ACCESS = "MEDIA_PORTAL_ACCESS";
export const MEDIA_PORTAL_TEAM_VIEW = "MEDIA_PORTAL_TEAM_VIEW";

export const MEDIA_MEMBER_PORTAL_PERMISSIONS: Record<"MEMBRO" | "LIDER", string[]> = {
  MEMBRO: [MEDIA_PORTAL_ACCESS],
  LIDER: [MEDIA_PORTAL_ACCESS, MEDIA_PORTAL_TEAM_VIEW],
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  ADMIN: "Administrador",
  FINANCEIRO: "Financeiro",
  OPERACAO: "Operação",
  COMERCIAL: "Comercial",
  GESTAO: "Gestão",
  CUSTOM: "Personalizado",
};
