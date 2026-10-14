import "server-only";
import { LINKEDIN_VERSION } from "../connect";
import { driveFileId } from "../drive";
import { imageBytes } from "./media";
import { driveSize, sendDriveInChunks } from "./stream";
import { PublishError, sleep, type PublishInput, type PublishResult } from "./types";

const API = "https://api.linkedin.com/rest";

const headers = (token: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${token}`, "LinkedIn-Version": LINKEDIN_VERSION, "X-Restli-Protocol-Version": "2.0.0", ...extra });

async function li<T>(path: string, token: string, init: RequestInit = {}): Promise<{ data: T; res: Response }> {
  const res = await fetch(`${API}${path}`, { ...init, headers: headers(token, (init.headers as Record<string, string>) ?? {}) });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as T & { message?: string };
  if (!res.ok) {
    const msg = (data as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new PublishError(`LinkedIn: ${msg}`, res.status === 401 || res.status === 403 || res.status === 422);
  }
  return { data, res };
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// O LinkedIn lê a legenda em "little text": estes caracteres precisam de barra para aparecer como texto.
export function escapeCommentary(text: string): string {
  return text.replace(/[\\|{}@[\]()<>*_~]/g, (c) => `\\${c}`);
}

async function uploadImage(i: PublishInput, owner: string, idx: number): Promise<string> {
  const { data } = await li<{ value: { uploadUrl: string; image: string } }>("/images?action=initializeUpload", i.accessToken, post({ initializeUploadRequest: { owner } }));
  const bytes = await imageBytes(i, i.media[idx]);
  const put = await fetch(data.value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${i.accessToken}`, "Content-Type": "application/octet-stream" }, body: new Uint8Array(bytes) });
  if (!put.ok) throw new PublishError(`LinkedIn: o envio da imagem falhou (HTTP ${put.status}).`);
  return data.value.image;
}

async function uploadVideo(i: PublishInput, owner: string, fileId: string): Promise<string> {
  const size = await driveSize(fileId);
  const { data } = await li<{ value: { video: string; uploadToken: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] } }>(
    "/videos?action=initializeUpload",
    i.accessToken,
    post({ initializeUploadRequest: { owner, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: false } }),
  );
  const parts = data.value.uploadInstructions;
  const plan = parts.map((p) => p.lastByte - p.firstByte + 1);
  const etags: string[] = [];
  let n = 0;
  await sendDriveInChunks(fileId, plan, async (chunk) => {
    const part = parts[n++];
    const put = await fetch(part.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: new Uint8Array(chunk) });
    if (!put.ok) throw new PublishError(`LinkedIn: o envio do vídeo falhou (HTTP ${put.status}).`);
    etags.push((put.headers.get("etag") ?? "").replace(/^"|"$/g, ""));
  });
  await li("/videos?action=finalizeUpload", i.accessToken, post({ finalizeUploadRequest: { video: data.value.video, uploadToken: data.value.uploadToken, uploadedPartIds: etags } }));
  for (let t = 0; t < 120; t++) {
    const { data: v } = await li<{ status?: string; processingFailureReason?: string }>(`/videos/${encodeURIComponent(data.value.video)}`, i.accessToken);
    if (v.status === "AVAILABLE") return data.value.video;
    if (v.status === "PROCESSING_FAILED") throw new PublishError(`LinkedIn: o vídeo foi recusado${v.processingFailureReason ? ` (${v.processingFailureReason})` : ""}.`, true);
    await sleep(5000);
  }
  throw new PublishError("LinkedIn: o vídeo demorou demais para ficar pronto. Tentaremos de novo.");
}

export async function publishLinkedin(i: PublishInput): Promise<PublishResult> {
  const author = i.account.externalId;
  let content: Record<string, unknown> | undefined;
  const videoIdx = i.media.findIndex((m) => m.kind === "video");
  if (videoIdx >= 0) {
    const fileId = driveFileId(i.media[videoIdx].url);
    if (!fileId) throw new PublishError("O vídeo precisa ser um link do Google Drive.", true);
    content = { media: { id: await uploadVideo(i, author, fileId), title: i.title.slice(0, 200) } };
  } else {
    const ids: string[] = [];
    for (let idx = 0; idx < Math.min(i.media.length, 20); idx++) if (i.media[idx].kind === "image") ids.push(await uploadImage(i, author, idx));
    if (ids.length === 1) content = { media: { id: ids[0] } };
    else if (ids.length > 1) content = { multiImage: { images: ids.map((id) => ({ id, altText: i.title.slice(0, 120) })) } };
  }
  const { res } = await li("/posts", i.accessToken, post({
    author,
    commentary: escapeCommentary((i.caption.trim() || i.title).slice(0, 3000)),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    ...(content ? { content } : {}),
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  }));
  const id = res.headers.get("x-restli-id") ?? "";
  return { externalId: id, externalUrl: id ? `https://www.linkedin.com/feed/update/${id}/` : null };
}
