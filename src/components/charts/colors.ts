// Paleta categórica validada (skill de dataviz) para o fundo escuro do
// LUMIHUB (#161618) — ordem fixa, nunca cíclica. Ver ARCHITECTURE.md.
export const CATEGORICAL_COLORS = [
  "#3987e5", // 1 azul
  "#d95926", // 2 laranja
  "#199e70", // 3 aqua
  "#c98500", // 4 amarelo
  "#d55181", // 5 magenta
  "#008300", // 6 verde
  "#9085e9", // 7 violeta
  "#e66767", // 8 vermelho
];

export const CHART_GRID_COLOR = "#27272A";
export const CHART_MUTED_TEXT = "#71717A";
export const CHART_PRIMARY_TEXT = "#F5F5F5";

export function categoricalColor(index: number): string {
  return CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];
}
