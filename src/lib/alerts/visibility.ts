import type { AlertCategory } from "@/generated/prisma/enums";

// Cada área de alerta só chega a quem trabalha naquela área: alerta de mídia
// para quem gerencia a Mídia ADESF, de dinheiro para o financeiro, etc.
export const ALERT_CATEGORY_PERMISSION: Record<AlertCategory, string[]> = {
  FINANCEIRO: ["FINANCE_VIEW"],
  CLIENTES: ["FINANCE_VIEW"],
  COMERCIAL: ["CRM_VIEW"],
  OPERACAO: ["PROJECTS_VIEW", "TASKS_VIEW", "CAPTURES_VIEW"],
  CONTRATOS: ["CONTRACTS_VIEW"],
  EQUIPE: ["TEAM_VIEW"],
  MIDIA_ADESF: ["MEDIA_ADESF_VIEW"],
};

export function alertVisibleTo(category: AlertCategory, permissions: Set<string>): boolean {
  if (!permissions.has("ALERTS_VIEW")) return false;
  return ALERT_CATEGORY_PERMISSION[category].some((k) => permissions.has(k));
}

export function visibleAlertCategories(permissions: Set<string>): AlertCategory[] {
  return (Object.keys(ALERT_CATEGORY_PERMISSION) as AlertCategory[]).filter((c) => alertVisibleTo(c, permissions));
}
