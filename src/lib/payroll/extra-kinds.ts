// Tipos de extra (serviços além do fixo que entram nos ganhos da pessoa).
export const EXTRA_KINDS = ["EDICAO_VIDEO", "GRAFICO", "CAPTACAO", "OUTRO"] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];

export const EXTRA_KIND_LABELS: Record<ExtraKind, string> = {
  EDICAO_VIDEO: "Edição de vídeo",
  GRAFICO: "Serviços gráficos",
  CAPTACAO: "Captação",
  OUTRO: "Outro extra",
};

export function extraKindLabel(kind: string): string {
  return EXTRA_KIND_LABELS[kind as ExtraKind] ?? "Extra";
}
