import type { CSSProperties } from "react";

export interface MediaBrandColors {
  primaryColor: string;
  secondaryColor: string;
  gradientStart: string;
  gradientEnd: string;
}

export const DEFAULT_MEDIA_BRAND: MediaBrandColors = {
  primaryColor: "#16A34A",
  secondaryColor: "#0F766E",
  gradientStart: "#16A34A",
  gradientEnd: "#22D3A8",
};

// Sobrescreve localmente os tokens de acento do Design System
// (--lh-accent/--lh-accent-light/...) com as cores do Mídia ADESF. Como o
// restante do tema (`@theme inline` em globals.css) só faz `var(--color-accent)
// -> var(--lh-accent)`, redefinir --lh-accent num wrapper propaga para todos
// os componentes existentes (Button, Badge, Avatar etc.) sem duplicar nenhum
// componente de UI — é o mesmo Design System, com outra cor de marca.
export function mediaThemeStyle(brand?: Partial<MediaBrandColors> | null): CSSProperties {
  const colors = { ...DEFAULT_MEDIA_BRAND, ...(brand ?? {}) };
  return {
    "--lh-accent": colors.primaryColor,
    "--lh-accent-light": colors.secondaryColor,
    "--lh-accent-deep": colors.gradientStart,
    "--lh-accent-gradient": `linear-gradient(135deg, ${colors.gradientStart} 0%, ${colors.primaryColor} 55%, ${colors.gradientEnd} 100%)`,
    "--lh-accent-on": "#04140d",
  } as CSSProperties;
}
