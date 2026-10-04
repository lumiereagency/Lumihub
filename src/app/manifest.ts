import type { MetadataRoute } from "next";

// Instala a LUMIBASE como app (tela inicial do celular e do computador).
// Ícones e telas de abertura gerados a partir da marca em src/lib/brand/rings.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LUMIBASE",
    short_name: "LUMIBASE",
    description: "Sistema operacional interno da Lumière Agency",
    lang: "pt-BR",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0B0A08",
    theme_color: "#0B0A08",
    icons: [
      { src: "/icons/icon-192.png?v=3", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
