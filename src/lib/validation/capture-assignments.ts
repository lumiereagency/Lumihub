export const CAPTURE_CREW_ROLES = ["VIDEOMAKER", "PHOTOGRAPHER", "STORYMAKER", "DRONE_OPERATOR"] as const;

export type CaptureCrewRole = (typeof CAPTURE_CREW_ROLES)[number];

export const CAPTURE_CREW_ROLE_LABELS: Record<CaptureCrewRole, string> = {
  VIDEOMAKER: "Videomaker",
  PHOTOGRAPHER: "Fotógrafo",
  STORYMAKER: "Storymaker",
  DRONE_OPERATOR: "Operador de drone",
};

// Mapeia cada papel de captação ao campo (texto livre, legado) e ao campo
// de seleção de usuário (novo) no formulário de captação.
export const CAPTURE_CREW_FORM_FIELDS: Record<CaptureCrewRole, { textField: string; userField: string }> = {
  VIDEOMAKER: { textField: "videomaker", userField: "videomakerUserId" },
  PHOTOGRAPHER: { textField: "photographer", userField: "photographerUserId" },
  STORYMAKER: { textField: "storymaker", userField: "storymakerUserId" },
  DRONE_OPERATOR: { textField: "droneOperator", userField: "droneOperatorUserId" },
};
