export const PROPOSAL_STATUSES = ["RASCUNHO", "ENVIADA", "EM_NEGOCIACAO", "ACEITA", "RECUSADA", "EXPIRADA"] as const;

export const PROPOSAL_STATUS_LABELS: Record<(typeof PROPOSAL_STATUSES)[number], string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  EM_NEGOCIACAO: "Em negociação",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  EXPIRADA: "Expirada",
};
