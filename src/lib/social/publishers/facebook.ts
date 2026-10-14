import "server-only";
import { GRAPH } from "../connect";
import { driveFileId } from "../drive";
import { publicImageUrl, signedMediaUrl } from "../media-url";
import { PublishError, type PublishInput, type PublishResult } from "./types";

async function post(path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & Record<string, unknown>;
  if (!res.ok || data.error) {
    const permanent = data.error?.code === 190 || data.error?.code === 10 || data.error?.code === 200;
    throw new PublishError(`Facebook: ${data.error?.message ?? `HTTP ${res.status}`}`, permanent);
  }
  return data;
}

export async function publishFacebook(i: PublishInput): Promise<PublishResult> {
  const pageId = i.account.externalId;
  const token = i.accessToken;
  const videoIdx = i.media.findIndex((m) => m.kind === "video");

  if (videoIdx >= 0) {
    if (!driveFileId(i.media[videoIdx].url)) throw new PublishError("O vídeo precisa ser um link do Google Drive.", true);
    const data = await post(`${pageId}/videos`, { file_url: signedMediaUrl(i.targetId, videoIdx), description: i.caption, access_token: token });
    const id = String(data.id);
    return { externalId: id, externalUrl: `https://www.facebook.com/${pageId}/videos/${id}` };
  }

  const images = i.media.map((m, idx) => ({ m, idx })).filter((x) => x.m.kind === "image" && x.m.storageKey);
  if (images.length === 0) throw new PublishError("Não há imagem para publicar.", true);
  if (images.length === 1) {
    const data = await post(`${pageId}/photos`, { url: publicImageUrl(i.batchToken, i.postId, images[0].idx), caption: i.caption, access_token: token });
    const id = String(data.post_id ?? data.id);
    return { externalId: id, externalUrl: `https://www.facebook.com/${id}` };
  }
  const attached: string[] = [];
  for (const img of images) {
    const data = await post(`${pageId}/photos`, { url: publicImageUrl(i.batchToken, i.postId, img.idx), published: "false", access_token: token });
    attached.push(JSON.stringify({ media_fbid: String(data.id) }));
  }
  const feed = await post(`${pageId}/feed`, { message: i.caption, attached_media: `[${attached.join(",")}]`, access_token: token });
  const id = String(feed.id);
  return { externalId: id, externalUrl: `https://www.facebook.com/${id}` };
}
