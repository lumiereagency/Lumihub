// Redes com publicação automática pela API oficial. Sem "server-only": usado
// também na tela (prévias e verificações).

export const SOCIAL_NETWORKS = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export function isSocialNetwork(value: string): value is SocialNetwork {
  return (SOCIAL_NETWORKS as readonly string[]).includes(value);
}

// Família de conexão: uma autorização Meta traz páginas do Facebook e contas do Instagram.
export type ConnectFamily = "meta" | "youtube" | "tiktok";
export const FAMILY_NETWORKS: Record<ConnectFamily, SocialNetwork[]> = {
  meta: ["FACEBOOK", "INSTAGRAM"],
  youtube: ["YOUTUBE"],
  tiktok: ["TIKTOK"],
};
export const FAMILY_LABELS: Record<ConnectFamily, string> = { meta: "Instagram e Facebook", youtube: "YouTube", tiktok: "TikTok" };
export function isConnectFamily(value: string): value is ConnectFamily {
  return value === "meta" || value === "youtube" || value === "tiktok";
}

export const NETWORK_LABEL: Record<SocialNetwork, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TIKTOK: "TikTok", YOUTUBE: "YouTube" };

// Limites divulgados pelas redes hoje. Ficam num só lugar para ajustar quando mudarem.
export const NETWORK_LIMITS = {
  INSTAGRAM: { captionMax: 2200, hashtagsMax: 30, carouselMax: 10, reelsMaxSeconds: 900, reelsMinSeconds: 3, reelsMaxMB: 300, feedRatio: [0.8, 1.91] as [number, number] },
  FACEBOOK: { captionMax: 63206, videoMaxMB: 1024 },
  TIKTOK: { captionMax: 2200, videoMaxSeconds: 600, videoMaxMB: 1024 },
  YOUTUBE: { titleMax: 100, descriptionMax: 5000, shortsMaxSeconds: 180, videoMaxMB: 2048 },
} as const;

// Formato de publicação por rede (o do post define o padrão).
export const TARGET_FORMATS: Record<SocialNetwork, { value: string; label: string }[]> = {
  INSTAGRAM: [{ value: "FEED", label: "Feed" }, { value: "REELS", label: "Reels" }],
  FACEBOOK: [{ value: "FEED", label: "Publicação" }, { value: "REELS", label: "Vídeo / Reels" }],
  TIKTOK: [{ value: "REELS", label: "Vídeo" }],
  YOUTUBE: [{ value: "REELS", label: "Shorts" }, { value: "VIDEO", label: "Vídeo" }],
};

export function defaultTargetFormat(network: SocialNetwork, postFormat: string, hasVideo: boolean): string {
  if (network === "TIKTOK") return "REELS";
  if (network === "YOUTUBE") return postFormat === "VIDEO" ? "VIDEO" : "REELS";
  // Só imagem: sempre publicação normal, mesmo que o post tenha sido planejado como Reels.
  if (!hasVideo) return "FEED";
  if (postFormat === "REELS") return "REELS";
  return network === "INSTAGRAM" ? "REELS" : "FEED";
}

export const TARGET_STATUS_LABEL: Record<string, string> = {
  AGENDADO: "Agendado",
  PUBLICANDO: "Publicando",
  PUBLICADO: "Publicado",
  FALHOU: "Falhou",
  CANCELADO: "Cancelado",
};
