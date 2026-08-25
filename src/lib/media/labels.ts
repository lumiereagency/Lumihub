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
