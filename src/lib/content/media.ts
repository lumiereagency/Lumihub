// Mídia dos posts: links de vídeo (Drive, YouTube, Vimeo) viram player na
// página do cliente; imagens são enviadas para a base (já reduzidas).
// O vídeo nunca é copiado para a base: só guardamos o endereço.

export interface MediaItem {
  kind: "video" | "image";
  url: string;
  provider?: "drive" | "youtube" | "vimeo" | "outro";
  // Endereço do player embutido (quando o provedor permite).
  embed?: string | null;
  // Imagem enviada para a base.
  storageKey?: string;
}

export const NETWORKS = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "TWITTER", "THREADS", "LINKEDIN", "REDDIT", "OUTRO"] as const;
export const NETWORK_LABELS: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TIKTOK: "TikTok", LINKEDIN: "LinkedIn", YOUTUBE: "YouTube", TWITTER: "X (Twitter)", THREADS: "Threads", REDDIT: "Reddit", OUTRO: "Outra rede" };
export const FORMATS = ["REELS", "FEED", "STORIES", "CARROSSEL", "VIDEO", "ARTIGO"] as const;
export const FORMAT_LABELS: Record<string, string> = { REELS: "Reels", FEED: "Feed", STORIES: "Stories", CARROSSEL: "Carrossel", VIDEO: "Vídeo", ARTIGO: "Artigo" };
export const STATUS_LABELS: Record<string, string> = { RASCUNHO: "Rascunho", AGUARDANDO: "Aguardando cliente", APROVADO: "Aprovado", AJUSTE: "Ajuste pedido", AGENDADO: "Agendado", PUBLICADO: "Publicado", FALHOU: "Falhou" };

export function parseVideoLink(raw: string): MediaItem | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.replace(/^www\./, "");

  if (host === "drive.google.com") {
    const id = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get("id");
    if (!id) return null;
    return { kind: "video", provider: "drive", url: url.toString(), embed: `https://drive.google.com/file/d/${id}/preview` };
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/") || url.pathname.startsWith("/live/")) id = url.pathname.split("/")[2];
    else id = url.searchParams.get("v");
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return { kind: "video", provider: "youtube", url: url.toString(), embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{6,})/)?.[1];
    if (!id) return null;
    const hash = url.searchParams.get("h") ?? url.pathname.match(/\/\d+\/([a-f0-9]+)/)?.[1];
    return { kind: "video", provider: "vimeo", url: url.toString(), embed: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ""}` };
  }
  // Outro endereço: guardamos, mas o cliente abre num link (sem player).
  return { kind: "video", provider: "outro", url: url.toString(), embed: null };
}
