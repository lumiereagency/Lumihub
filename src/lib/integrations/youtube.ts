import "server-only";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integrations/vault";

// Busca de prospects por nicho no YouTube (§ pedido do usuário: focar em
// figuras públicas/criadores já conhecidos, com audiência grande, mas com
// um "gargalo de produção" — muito conteúdo longo acumulado e pouco ou
// nenhum corte/Short sendo publicado, exatamente o padrão observado no
// caso real que motivou isso: um artista com muitos inscritos, mas sem
// recorrência de posts). Usa só a API oficial do YouTube (cota gratuita,
// sem cartão de crédito) — nunca raspagem de Instagram/TikTok, que não tem
// endpoint de busca aberto por terceiros.

const API_BASE = "https://www.googleapis.com/youtube/v3";
const TIMEOUT_MS = 10000;

export type LeadTemperature = "QUENTE" | "MORNO" | "FRIO";

export interface YoutubeProspect {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  channelUrl: string;
  subscriberCount: number;
  videoCount: number;
  daysSinceLastUpload: number | null;
  shortsRatio: number | null;
  temperature: LeadTemperature;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getYoutubeApiKey(organizationId: string): Promise<string | null> {
  const integration = await db.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "YOUTUBE_DATA_API" } },
    include: { credentials: true },
  });
  if (!integration || integration.status !== "CONECTADO") return null;

  const credential = integration.credentials.find((c) => c.label === "apiKey");
  if (!credential) return null;

  return decryptSecret({ encryptedValue: credential.encryptedValue, iv: credential.iv, authTag: credential.authTag });
}

// "PT1H2M10S" -> segundos. YouTube sempre devolve duração ISO 8601 nesse
// formato (sem dias/semanas para vídeo, só H/M/S).
function parseIsoDurationSeconds(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, h, m, s] = match;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

const SHORT_MAX_SECONDS = 60;
// Abaixo disso não é "figura pública conhecida" o suficiente para o
// posicionamento de vendas descrito (produção mensal + cortes para artista
// com legado) — filtra ruído de canais pequenos/irrelevantes.
const DEFAULT_MIN_SUBSCRIBERS = 50_000;
const STALE_UPLOAD_DAYS = 45;

function computeTemperature(daysSinceLastUpload: number | null, shortsRatio: number | null): LeadTemperature {
  if (shortsRatio !== null && shortsRatio >= 0.3) return "FRIO"; // já corta e publica Shorts com regularidade
  if (daysSinceLastUpload === null || daysSinceLastUpload >= STALE_UPLOAD_DAYS || shortsRatio === 0) return "QUENTE";
  return "MORNO";
}

interface SearchOptions {
  minSubscribers?: number;
}

export async function searchYoutubeProspects(
  organizationId: string,
  query: string,
  options: SearchOptions = {},
): Promise<{ prospects: YoutubeProspect[] } | { error: string }> {
  const apiKey = await getYoutubeApiKey(organizationId);
  if (!apiKey) return { error: "Conecte a YouTube Data API em Configurações → Integrações antes de buscar." };

  const minSubscribers = options.minSubscribers ?? DEFAULT_MIN_SUBSCRIBERS;

  let searchRes: Response;
  try {
    searchRes = await fetchWithTimeout(
      `${API_BASE}/search?part=snippet&type=channel&maxResults=15&q=${encodeURIComponent(query)}&key=${apiKey}`,
    );
  } catch (err) {
    return { error: `Falha ao contatar o YouTube: ${(err as Error).message}` };
  }
  if (!searchRes.ok) {
    const body = await searchRes.json().catch(() => null);
    return { error: `YouTube recusou a busca (HTTP ${searchRes.status})${body?.error?.message ? `: ${body.error.message}` : "."}` };
  }
  const searchData = (await searchRes.json()) as { items?: { snippet: { channelId: string } }[] };
  const channelIds = [...new Set((searchData.items ?? []).map((item) => item.snippet.channelId))];
  if (channelIds.length === 0) return { prospects: [] };

  const channelsRes = await fetchWithTimeout(
    `${API_BASE}/channels?part=snippet,statistics,contentDetails&id=${channelIds.join(",")}&key=${apiKey}`,
  );
  if (!channelsRes.ok) return { error: `YouTube recusou a consulta de canais (HTTP ${channelsRes.status}).` };
  const channelsData = (await channelsRes.json()) as {
    items?: {
      id: string;
      snippet: { title: string; description: string; thumbnails?: { default?: { url: string } } };
      statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }[];
  };

  const candidates = (channelsData.items ?? []).filter((c) => {
    const subs = Number(c.statistics.subscriberCount ?? 0);
    return !c.statistics.hiddenSubscriberCount && subs >= minSubscribers;
  });

  const prospects = await Promise.all(
    candidates.map(async (channel): Promise<YoutubeProspect> => {
      const subscriberCount = Number(channel.statistics.subscriberCount ?? 0);
      const videoCount = Number(channel.statistics.videoCount ?? 0);
      const { daysSinceLastUpload, shortsRatio } = await getUploadSignal(channel.contentDetails.relatedPlaylists.uploads, apiKey);

      return {
        channelId: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnailUrl: channel.snippet.thumbnails?.default?.url ?? null,
        channelUrl: `https://www.youtube.com/channel/${channel.id}`,
        subscriberCount,
        videoCount,
        daysSinceLastUpload,
        shortsRatio,
        temperature: computeTemperature(daysSinceLastUpload, shortsRatio),
      };
    }),
  );

  const TEMPERATURE_ORDER: Record<LeadTemperature, number> = { QUENTE: 0, MORNO: 1, FRIO: 2 };
  prospects.sort((a, b) => TEMPERATURE_ORDER[a.temperature] - TEMPERATURE_ORDER[b.temperature] || b.subscriberCount - a.subscriberCount);

  return { prospects };
}

// Analisa os uploads mais recentes de um canal pra medir dois sinais: há
// quanto tempo não posta nada, e que fração do que posta já é Short (corte).
async function getUploadSignal(uploadsPlaylistId: string, apiKey: string): Promise<{ daysSinceLastUpload: number | null; shortsRatio: number | null }> {
  try {
    const playlistRes = await fetchWithTimeout(
      `${API_BASE}/playlistItems?part=contentDetails&maxResults=15&playlistId=${uploadsPlaylistId}&key=${apiKey}`,
    );
    if (!playlistRes.ok) return { daysSinceLastUpload: null, shortsRatio: null };
    const playlistData = (await playlistRes.json()) as { items?: { contentDetails: { videoId: string; videoPublishedAt?: string } }[] };
    const items = playlistData.items ?? [];
    if (items.length === 0) return { daysSinceLastUpload: null, shortsRatio: null };

    const videoIds = items.map((i) => i.contentDetails.videoId).join(",");
    const videosRes = await fetchWithTimeout(`${API_BASE}/videos?part=contentDetails,snippet&id=${videoIds}&key=${apiKey}`);
    if (!videosRes.ok) return { daysSinceLastUpload: null, shortsRatio: null };
    const videosData = (await videosRes.json()) as { items?: { contentDetails: { duration: string }; snippet: { publishedAt: string } }[] };
    const videos = videosData.items ?? [];
    if (videos.length === 0) return { daysSinceLastUpload: null, shortsRatio: null };

    const mostRecent = videos.reduce((latest, v) => (v.snippet.publishedAt > latest ? v.snippet.publishedAt : latest), videos[0].snippet.publishedAt);
    const daysSinceLastUpload = Math.floor((Date.now() - new Date(mostRecent).getTime()) / (24 * 60 * 60 * 1000));

    const shortsCount = videos.filter((v) => parseIsoDurationSeconds(v.contentDetails.duration) <= SHORT_MAX_SECONDS).length;
    const shortsRatio = shortsCount / videos.length;

    return { daysSinceLastUpload, shortsRatio };
  } catch {
    return { daysSinceLastUpload: null, shortsRatio: null };
  }
}
