import "server-only";
import { driveFileId } from "../drive";
import { imageBytes, imageMime } from "./media";
import { driveSize, sendDriveInChunks } from "./stream";
import { PublishError, sleep, type PublishInput, type PublishResult } from "./types";

const API = "https://api.x.com/2";
const CHUNK = 5 * 1024 * 1024; // o X aceita até 8 MB por pedaço; 5 MB é o recomendado

async function x<T>(path: string, token: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as { detail?: string; title?: string; errors?: { message?: string }[] };
  if (!res.ok) {
    const msg = data.detail ?? data.errors?.[0]?.message ?? data.title ?? `HTTP ${res.status}`;
    // 401/403: token sem permissão, conta suspensa ou limite do plano; repetir não resolve.
    throw new PublishError(`X: ${msg}`, res.status === 401 || res.status === 403 || res.status === 402);
  }
  return data as T;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function waitProcessing(token: string, mediaId: string, info?: { state?: string; check_after_secs?: number }) {
  let state = info?.state;
  let wait = info?.check_after_secs ?? 2;
  for (let n = 0; n < 120 && state && state !== "succeeded"; n++) {
    if (state === "failed") throw new PublishError("X: o processamento do vídeo falhou.", true);
    await sleep(Math.max(1, wait) * 1000);
    const s = await x<{ data?: { processing_info?: { state?: string; check_after_secs?: number } } }>(`/media/upload?command=STATUS&media_id=${mediaId}`, token, { method: "GET" });
    state = s.data?.processing_info?.state ?? "succeeded";
    wait = s.data?.processing_info?.check_after_secs ?? 3;
  }
}

async function append(token: string, id: string, index: number, chunk: Buffer) {
  const body = new FormData();
  body.set("segment_index", String(index));
  body.set("media", new Blob([new Uint8Array(chunk)]), "chunk");
  await x(`/media/upload/${id}/append`, token, { method: "POST", body });
}

async function uploadImage(i: PublishInput, idx: number): Promise<string> {
  const item = i.media[idx];
  const bytes = await imageBytes(i, item);
  const init = await x<{ data: { id: string } }>("/media/upload/initialize", i.accessToken, json({ media_type: imageMime(item), total_bytes: bytes.length, media_category: "tweet_image" }));
  const id = init.data.id;
  await append(i.accessToken, id, 0, bytes);
  const fin = await x<{ data?: { processing_info?: { state?: string; check_after_secs?: number } } }>(`/media/upload/${id}/finalize`, i.accessToken, { method: "POST" });
  await waitProcessing(i.accessToken, id, fin.data?.processing_info);
  return id;
}

async function uploadVideo(i: PublishInput, fileId: string): Promise<string> {
  const size = await driveSize(fileId);
  const init = await x<{ data: { id: string } }>("/media/upload/initialize", i.accessToken, json({ media_type: "video/mp4", total_bytes: size, media_category: "tweet_video" }));
  const id = init.data.id;
  const plan: number[] = [];
  for (let left = size; left > 0; left -= CHUNK) plan.push(Math.min(CHUNK, left));
  let segment = 0;
  await sendDriveInChunks(fileId, plan, async (chunk) => {
    await append(i.accessToken, id, segment++, chunk);
  });
  const fin = await x<{ data?: { processing_info?: { state?: string; check_after_secs?: number } } }>(`/media/upload/${id}/finalize`, i.accessToken, { method: "POST" });
  await waitProcessing(i.accessToken, id, fin.data?.processing_info);
  return id;
}

export async function publishTwitter(i: PublishInput): Promise<PublishResult> {
  const mediaIds: string[] = [];
  const videoIdx = i.media.findIndex((m) => m.kind === "video");
  if (videoIdx >= 0) {
    const fileId = driveFileId(i.media[videoIdx].url);
    if (!fileId) throw new PublishError("O vídeo precisa ser um link do Google Drive.", true);
    mediaIds.push(await uploadVideo(i, fileId));
  } else {
    for (let idx = 0; idx < Math.min(i.media.length, 4); idx++) if (i.media[idx].kind === "image") mediaIds.push(await uploadImage(i, idx));
  }
  const text = (i.caption.trim() || i.title).slice(0, 25000);
  const tweet = await x<{ data: { id: string } }>("/tweets", i.accessToken, json({ text, ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}) }));
  const username = (i.account.meta as { username?: string } | null)?.username;
  return { externalId: tweet.data.id, externalUrl: `https://x.com/${username ?? "i"}/status/${tweet.data.id}` };
}
