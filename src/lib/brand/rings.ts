// Marca LUMI: duas alianças entrelaçadas (desenho de 120 × 72).
// As alianças ficam próximas o bastante para abrir um vão mínimo no centro;
// no cruzamento de cima a da esquerda passa por cima, no de baixo a da
// direita, com uma fresta fina onde uma passa sobre a outra. De longe
// continua lendo como um infinito.
export const RING = {
  r: 27,
  stroke: 9.5,
  halfDistance: 20.5,
  gap: 1.5,
  cy: 36,
  get left() {
    return 60 - this.halfDistance;
  },
  get right() {
    return 60 + this.halfDistance;
  },
  // Pontos (x = 60) onde as linhas centrais das alianças se cruzam.
  get crossTop() {
    return this.cy - Math.sqrt(this.r ** 2 - this.halfDistance ** 2);
  },
  get crossBottom() {
    return this.cy + Math.sqrt(this.r ** 2 - this.halfDistance ** 2);
  },
} as const;

// Ouro metálico dos documentos (Guia, orçamento, contrato).
export const GOLD_STOPS = [
  { offset: 0, color: "#FBE7B4" },
  { offset: 0.38, color: "#E2BE70" },
  { offset: 0.72, color: "#A9802F" },
  { offset: 1, color: "#E4C47C" },
] as const;

// SVG completo da marca como texto (ícones, favicon e scripts de geração).
export function ringsSvgMarkup(opts: { id?: string; stroke?: number; gap?: number } = {}): string {
  const id = opts.id ?? "lumi";
  const w = opts.stroke ?? RING.stroke;
  const cut = w + 2 * (opts.gap ?? RING.gap);
  const { r, cy, left: L, right: R, crossTop: T, crossBottom: B } = RING;
  const stops = GOLD_STOPS.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("");
  return (
    `<defs><linearGradient id="${id}-g" x1="10" y1="6" x2="110" y2="70" gradientUnits="userSpaceOnUse">${stops}</linearGradient>` +
    `<clipPath id="${id}-ct"><circle cx="60" cy="${T}" r="14"/></clipPath>` +
    `<clipPath id="${id}-cb"><circle cx="60" cy="${B}" r="14"/></clipPath>` +
    `<mask id="${id}-mr" maskUnits="userSpaceOnUse" x="-10" y="-10" width="140" height="92"><rect x="-10" y="-10" width="140" height="92" fill="#fff"/><g clip-path="url(#${id}-ct)"><circle cx="${L}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-width="${cut}"/></g></mask>` +
    `<mask id="${id}-ml" maskUnits="userSpaceOnUse" x="-10" y="-10" width="140" height="92"><rect x="-10" y="-10" width="140" height="92" fill="#fff"/><g clip-path="url(#${id}-cb)"><circle cx="${R}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-width="${cut}"/></g></mask></defs>` +
    `<circle cx="${L}" cy="${cy}" r="${r}" fill="none" stroke="url(#${id}-g)" stroke-width="${w}" mask="url(#${id}-ml)"/>` +
    `<circle cx="${R}" cy="${cy}" r="${r}" fill="none" stroke="url(#${id}-g)" stroke-width="${w}" mask="url(#${id}-mr)"/>`
  );
}
