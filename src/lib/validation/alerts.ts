export const ALERT_CATEGORIES = ["FINANCEIRO", "COMERCIAL", "OPERACAO", "CLIENTES", "CONTRATOS", "EQUIPE"] as const;

export const ALERT_CATEGORY_LABELS: Record<(typeof ALERT_CATEGORIES)[number], string> = {
  FINANCEIRO: "Financeiro",
  COMERCIAL: "Comercial",
  OPERACAO: "Operação",
  CLIENTES: "Clientes",
  CONTRATOS: "Contratos",
  EQUIPE: "Equipe",
};

export const ALERT_SEVERITIES = ["URGENTE", "ATENCAO", "INFORMATIVO", "OPORTUNIDADE"] as const;

export const ALERT_SEVERITY_LABELS: Record<(typeof ALERT_SEVERITIES)[number], string> = {
  URGENTE: "Urgente",
  ATENCAO: "Atenção",
  INFORMATIVO: "Informativo",
  OPORTUNIDADE: "Oportunidade",
};

export const ALERT_SEVERITY_TONE: Record<(typeof ALERT_SEVERITIES)[number], "error" | "warning" | "info" | "success"> = {
  URGENTE: "error",
  ATENCAO: "warning",
  INFORMATIVO: "info",
  OPORTUNIDADE: "success",
};

export const ALERT_STATUSES = ["ABERTO", "RESOLVIDO", "DISPENSADO"] as const;

export const ALERT_STATUS_LABELS: Record<(typeof ALERT_STATUSES)[number], string> = {
  ABERTO: "Aberto",
  RESOLVIDO: "Resolvido",
  DISPENSADO: "Dispensado",
};
