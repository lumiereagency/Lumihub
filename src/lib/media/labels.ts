export const MEDIA_ROLE_LABELS: Record<string, string> = {
  LIDER: "Líder",
  MEMBRO: "Membro",
};

export const MEDIA_STATUS_LABELS: Record<string, string> = {
  INVITED: "Convite pendente",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
};

export const MEDIA_STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "error"> = {
  INVITED: "warning",
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "error",
};

export const MEDIA_FUNCTION_ASSIGNMENT_LABELS: Record<string, string> = {
  EM_TREINAMENTO: "Em treinamento",
  HABILITADO: "Habilitado",
  AVANCADO: "Avançado",
};

export const MEDIA_EVENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado",
};

export const MEDIA_EVENT_STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  CONFIRMED: "success",
  COMPLETED: "neutral",
  CANCELLED: "error",
  ARCHIVED: "neutral",
};

export const MEDIA_SCHEDULE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  PUBLISHED: "Publicada",
  ARCHIVED: "Arquivada",
};

export const MEDIA_SCHEDULE_STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  DRAFT: "neutral",
  REVIEW: "warning",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
};

export const MEDIA_ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  UNASSIGNED: "Vaga aberta",
  ASSIGNED: "Atribuído",
  CONFIRMED: "Confirmado",
  SWAP_PENDING: "Troca em andamento",
  COMPLETED: "Concluído",
  ABSENT: "Ausente",
};

export const MEDIA_SWAP_STATUS_LABELS: Record<string, string> = {
  PENDING_TARGET: "Aguardando substituto",
  TARGET_ACCEPTED: "Aceita pelo substituto",
  TARGET_REJECTED: "Recusada pelo substituto",
  PENDING_LEADER: "Aguardando liderança",
  APPROVED: "Aprovada",
  REJECTED: "Recusada pela liderança",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

export const MEDIA_SWAP_STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  PENDING_TARGET: "warning",
  TARGET_ACCEPTED: "info",
  TARGET_REJECTED: "error",
  PENDING_LEADER: "warning",
  APPROVED: "success",
  REJECTED: "error",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

export const MEDIA_CONFIRMATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  DECLINED: "Não poderá comparecer",
  EXPIRED: "Prazo expirado",
};

export const MEDIA_CHECKIN_STATUS_LABELS: Record<string, string> = {
  PENDING: "Aguardando check-in",
  CHECKED_IN: "Presente",
  NO_SHOW: "Não compareceu",
};
