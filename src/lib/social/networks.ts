// Redes com publicação automática pela API oficial. Sem "server-only": usado
// também na tela (prévias e verificações).

export const SOCIAL_NETWORKS = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "TWITTER", "THREADS", "LINKEDIN", "REDDIT"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export function isSocialNetwork(value: string): value is SocialNetwork {
  return (SOCIAL_NETWORKS as readonly string[]).includes(value);
}

// Família de conexão: uma autorização Meta traz páginas do Facebook e contas do Instagram.
export type ConnectFamily = "meta" | "youtube" | "tiktok" | "x" | "threads" | "linkedin" | "reddit";
export const FAMILY_NETWORKS: Record<ConnectFamily, SocialNetwork[]> = {
  meta: ["FACEBOOK", "INSTAGRAM"],
  youtube: ["YOUTUBE"],
  tiktok: ["TIKTOK"],
  x: ["TWITTER"],
  threads: ["THREADS"],
  linkedin: ["LINKEDIN"],
  reddit: ["REDDIT"],
};
export const FAMILY_LABELS: Record<ConnectFamily, string> = { meta: "Instagram e Facebook", youtube: "YouTube", tiktok: "TikTok", x: "X (Twitter)", threads: "Threads", linkedin: "LinkedIn", reddit: "Reddit" };
export function isConnectFamily(value: string): value is ConnectFamily {
  return ["meta", "youtube", "tiktok", "x", "threads", "linkedin", "reddit"].includes(value);
}

export const NETWORK_LABEL: Record<SocialNetwork, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TIKTOK: "TikTok", YOUTUBE: "YouTube", TWITTER: "X (Twitter)", THREADS: "Threads", LINKEDIN: "LinkedIn", REDDIT: "Reddit" };

// Limites divulgados pelas redes hoje. Ficam num só lugar para ajustar quando mudarem.
export const NETWORK_LIMITS = {
  INSTAGRAM: { captionMax: 2200, hashtagsMax: 30, carouselMax: 10, reelsMaxSeconds: 900, reelsMinSeconds: 3, reelsMaxMB: 300, feedRatio: [0.8, 1.91] as [number, number] },
  FACEBOOK: { captionMax: 63206, videoMaxMB: 1024 },
  TIKTOK: { captionMax: 2200, videoMaxSeconds: 600, videoMaxMB: 1024 },
  YOUTUBE: { titleMax: 100, descriptionMax: 5000, shortsMaxSeconds: 180, videoMaxMB: 2048 },
  TWITTER: { textMax: 280, textMaxPremium: 25000, images: 4, videoSoftSeconds: 140, videoMaxSeconds: 1200, videoMaxMB: 512 },
  THREADS: { textMax: 500, carouselMax: 20, videoMaxSeconds: 300, videoMaxMB: 1024 },
  LINKEDIN: { textMax: 3000, images: 20, videoMinSeconds: 3, videoMaxSeconds: 1800, videoMaxMB: 500 },
  REDDIT: { titleMax: 300, textMax: 40000 },
} as const;

// Formato de publicação por rede (o do post define o padrão).
export const TARGET_FORMATS: Record<SocialNetwork, { value: string; label: string }[]> = {
  INSTAGRAM: [{ value: "FEED", label: "Feed" }, { value: "REELS", label: "Reels" }],
  FACEBOOK: [{ value: "FEED", label: "Publicação" }, { value: "REELS", label: "Vídeo / Reels" }],
  TIKTOK: [{ value: "REELS", label: "Vídeo" }],
  YOUTUBE: [{ value: "REELS", label: "Shorts" }, { value: "VIDEO", label: "Vídeo" }],
  TWITTER: [{ value: "FEED", label: "Post" }],
  THREADS: [{ value: "FEED", label: "Post" }],
  LINKEDIN: [{ value: "FEED", label: "Post" }],
  REDDIT: [{ value: "FEED", label: "Post" }],
};

export function defaultTargetFormat(network: SocialNetwork, postFormat: string, hasVideo: boolean): string {
  if (network === "TWITTER" || network === "THREADS" || network === "LINKEDIN" || network === "REDDIT") return "FEED";
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
