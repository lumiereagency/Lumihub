import "server-only";
import { GRAPH } from "../connect";
import { driveFileId } from "../drive";
import { publicImageUrl, signedMediaUrl } from "../media-url";
import { PublishError, sleep, type PublishInput, type PublishResult } from "./types";

async function call(method: "GET" | "POST", path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params);
  const res = await fetch(method === "GET" ? `${GRAPH}/${path}?${qs}` : `${GRAPH}/${path}`, method === "POST" ? { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs } : undefined);
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_user_msg?: string } } & Record<string, unknown>;
  if (!res.ok || data.error) {
    const permanent = [190, 10, 200, 2207026, 9004].includes(data.error?.code ?? 0);
    throw new PublishError(`Instagram: ${data.error?.error_user_msg ?? data.error?.message ?? `HTTP ${res.status}`}`, permanent);
  }
  return data;
}

// O vídeo é processado pelo Instagram depois do envio: esperamos ficar pronto.
async function waitReady(containerId: string, token: string, videoSeconds: number) {
  const tries = Math.ceil(videoSeconds / 10);
  for (let n = 0; n < tries; n++) {
    const s = await call("GET", containerId, { fields: "status_code,status", access_token: token });
    const code = String(s.status_code ?? "");
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") throw new PublishError(`Instagram: o processamento falhou (${String(s.status ?? code)}).`, true);
    await sleep(10_000);
  }
  throw new PublishError("Instagram: o vídeo demorou demais para ficar pronto. Tentaremos de novo.");
}

export async function publishInstagram(i: PublishInput): Promise<PublishResult> {
  const igId = i.account.externalId;
  const token = i.accessToken;
  const videoIdx = i.media.findIndex((m) => m.kind === "video");
  let container: string;

  if (i.format === "REELS" || (videoIdx >= 0 && i.media.length === 1)) {
    if (videoIdx < 0 || !driveFileId(i.media[videoIdx].url)) throw new PublishError("O Reels precisa de um vídeo do Google Drive.", true);
    const c = await call("POST", `${igId}/media`, { media_type: "REELS", video_url: signedMediaUrl(i.targetId, videoIdx), caption: i.caption, share_to_feed: "true", access_token: token });
    container = String(c.id);
    await waitReady(container, token, 900);
  } else if (i.media.length === 1) {
    const c = await call("POST", `${igId}/media`, { image_url: publicImageUrl(i.batchToken, i.postId, 0), caption: i.caption, access_token: token });
    container = String(c.id);
    await waitReady(container, token, 60);
  } else {
    const children: string[] = [];
    for (let idx = 0; idx < i.media.length; idx++) {
      const m = i.media[idx];
      const params: Record<string, string> = { is_carousel_item: "true", access_token: token };
      if (m.kind === "video") {
        if (!driveFileId(m.url)) throw new PublishError("Os vídeos do carrossel precisam ser links do Google Drive.", true);
        params.media_type = "VIDEO";
        params.video_url = signedMediaUrl(i.targetId, idx);
      } else params.image_url = publicImageUrl(i.batchToken, i.postId, idx);
      const c = await call("POST", `${igId}/media`, params);
      children.push(String(c.id));
      await waitReady(String(c.id), token, m.kind === "video" ? 600 : 60);
    }
    const parent = await call("POST", `${igId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: i.caption, access_token: token });
    container = String(parent.id);
    await waitReady(container, token, 60);
  }

  const published = await call("POST", `${igId}/media_publish`, { creation_id: container, access_token: token });
  const mediaId = String(published.id);
  const info = await call("GET", mediaId, { fields: "permalink", access_token: token }).catch(() => ({}) as Record<string, unknown>);
  return { externalId: mediaId, externalUrl: typeof info.permalink === "string" ? info.permalink : null };
}
