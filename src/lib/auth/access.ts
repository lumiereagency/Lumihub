import { permKey, type Module } from "@/lib/auth/permissions";

// Acessos por pessoa: cada usuário soma as permissões do perfil principal e
// dos perfis adicionais; por cima disso, ajustes aba por aba decidem se a
// pessoa não vê, só vê ou usa a aba por completo.

export type ModuleLevel = "off" | "view" | "full";
export type ModuleAccess = Partial<Record<Module, ModuleLevel>>;

// Chaves calculadas na sessão (não ficam no banco): quem pode abrir a tela de
// Acessos, e com qual alcance.
export const ACCESS_MANAGE_ALL = "ACCESS_MANAGE_ALL";
export const ACCESS_MANAGE_OPERATIONAL = "ACCESS_MANAGE_OPERATIONAL";
// Gestão do Mídia ADESF dentro da LUMIBASE: só quem recebeu o módulo pelo
// perfil ou pelos acessos. O líder de mídia gerencia pelo portal (/midia),
// então o menu da LUMIBASE não mostra o Mídia ADESF para ele.
export const MEDIA_ADESF_IN_LUMIBASE = "MEDIA_ADESF_IN_LUMIBASE";
export const MEDIA_ADESF_MANAGE_IN_LUMIBASE = "MEDIA_ADESF_MANAGE_IN_LUMIBASE";

export interface AccessTab {
  module: Module;
  label: string;
  hint: string;
  group: "Comercial" | "Clientes" | "Operação" | "Financeiro" | "Equipe e gestão" | "Inteligência" | "Mídia ADESF";
}

// Abas que podem ser liberadas ou fechadas por pessoa. Dashboard, Usuários,
// Integrações e Configurações ficam fora: seguem o perfil.
export const ACCESS_TABS: AccessTab[] = [
  { module: "CRM", label: "CRM e Comissões", hint: "Funil, orçamentos e comissões", group: "Comercial" },
  { module: "CLIENTS", label: "Clientes", hint: "Cadastro dos clientes", group: "Clientes" },
  { module: "CONTRACTS", label: "Contratos", hint: "Contratos e assinaturas", group: "Clientes" },
  { module: "TASKS", label: "Workspace", hint: "Quadros e cartões de trabalho", group: "Operação" },
  { module: "PROJECTS", label: "Projetos", hint: "Projetos dos clientes", group: "Operação" },
  { module: "CAPTURES", label: "Captações", hint: "Agenda de gravações", group: "Operação" },
  { module: "CALENDAR", label: "Agenda", hint: "Compromissos", group: "Operação" },
  { module: "FINANCE", label: "Financeiro", hint: "Visão geral, caixa e impostos", group: "Financeiro" },
  { module: "RECEIVABLES", label: "Contas a receber", hint: "Recebimentos e cobranças", group: "Financeiro" },
  { module: "PAYABLES", label: "Contas a pagar", hint: "Despesas e pagamentos da equipe", group: "Financeiro" },
  { module: "CARDS", label: "Cartões", hint: "Cartões da empresa", group: "Financeiro" },
  { module: "INVESTMENTS", label: "Investimentos", hint: "Aplicações", group: "Financeiro" },
  { module: "TEAM", label: "Equipe", hint: "Funcionários e freelancers", group: "Equipe e gestão" },
  { module: "GOALS", label: "Metas", hint: "Metas da empresa", group: "Equipe e gestão" },
  { module: "REPORTS", label: "Relatórios", hint: "Relatórios e exportações", group: "Equipe e gestão" },
  { module: "DOCUMENTS", label: "Documentos", hint: "Arquivos da empresa", group: "Equipe e gestão" },
  { module: "AI", label: "Lumi AI e Insights", hint: "Assistente e análises", group: "Inteligência" },
  { module: "ALERTS", label: "Alertas", hint: "Avisos da base", group: "Inteligência" },
  { module: "MEDIA_ADESF", label: "Mídia ADESF", hint: "Gestão da equipe de mídia", group: "Mídia ADESF" },
];

// O que a Gestão operacional pode liberar ou fechar para alguém.
export const OPERATIONAL_MODULES: Module[] = ["TASKS", "PROJECTS", "CAPTURES", "CALENDAR", "DOCUMENTS"];

const TAB_MODULES = new Set<string>(ACCESS_TABS.map((t) => t.module));
const LEVELS = new Set<string>(["off", "view", "full"]);

export function parseModuleAccess(raw: unknown): ModuleAccess {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ModuleAccess = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (TAB_MODULES.has(k) && typeof v === "string" && LEVELS.has(v)) out[k as Module] = v as ModuleLevel;
  }
  return out;
}

const FULL_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT"] as const;

// Aplica os ajustes por aba sobre o conjunto vindo dos perfis (muta e devolve).
// "full" não concede MANAGE: gerenciar continua sendo coisa do perfil.
export function applyModuleAccess(permissions: Set<string>, access: ModuleAccess): Set<string> {
  for (const [module, level] of Object.entries(access) as [Module, ModuleLevel][]) {
    const prefix = `${module}_`;
    if (level === "off" || level === "view") {
      for (const key of [...permissions]) if (key.startsWith(prefix)) permissions.delete(key);
    }
    if (level === "view") permissions.add(permKey(module, "VIEW"));
    if (level === "full") for (const a of FULL_ACTIONS) permissions.add(permKey(module, a));
  }
  return permissions;
}

// Nível que a pessoa tem hoje numa aba, olhando o conjunto final.
export function levelOf(permissions: Set<string> | string[], module: Module): ModuleLevel {
  const has = (k: string) => (Array.isArray(permissions) ? permissions.includes(k) : permissions.has(k));
  if (!has(permKey(module, "VIEW"))) return "off";
  return has(permKey(module, "CREATE")) || has(permKey(module, "EDIT")) ? "full" : "view";
}

export interface AccessSource {
  rolePermissions: string[];
  extraRolePermissions: string[][];
  moduleAccess: unknown;
}

// Permissões efetivas (sem as do portal de mídia, que a sessão soma depois).
export function effectivePermissions(src: AccessSource): Set<string> {
  const set = new Set(src.rolePermissions);
  for (const list of src.extraRolePermissions) for (const k of list) set.add(k);
  return applyModuleAccess(set, parseModuleAccess(src.moduleAccess));
}
