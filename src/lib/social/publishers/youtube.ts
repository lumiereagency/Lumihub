import "server-only";
import { driveFileId } from "../drive";
import { driveSize, sendDriveInChunks } from "./stream";
import { PublishError, type PublishInput, type PublishResult } from "./types";

const CHUNK = 8 * 1024 * 1024; // múltiplo de 256 KiB, como o YouTube exige

export async function publishYoutube(i: PublishInput): Promise<PublishResult> {
  const video = i.media.find((m) => m.kind === "video");
  const fileId = video ? driveFileId(video.url) : null;
  if (!fileId) throw new PublishError("O YouTube precisa de um vídeo do Google Drive.", true);
  const size = await driveSize(fileId);

  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${i.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size),
      "X-Upload-Content-Type": "video/*",
    },
    body: JSON.stringify({
      snippet: { title: i.title.slice(0, 100), description: i.caption.slice(0, 5000), categoryId: "22" },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });
  if (!init.ok) {
    const body = (await init.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new PublishError(`YouTube: ${body.error?.message ?? `HTTP ${init.status}`}`, init.status === 401 || init.status === 403);
  }
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new PublishError("YouTube: não devolveu o endereço de envio.");

  const plan: number[] = [];
  for (let left = size; left > 0; left -= CHUNK) plan.push(Math.min(CHUNK, left));
  let videoId: string | null = null;
  await sendDriveInChunks(fileId, plan, async (chunk, start, end) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Length": String(chunk.length), "Content-Range": `bytes ${start}-${end}/${size}` },
      body: new Uint8Array(chunk),
    });
    if (res.status === 308) return;
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      videoId = data.id ?? null;
      return;
    }
    throw new PublishError(`YouTube: o envio falhou (HTTP ${res.status}).`);
  });
  if (!videoId) throw new PublishError("YouTube: o envio terminou sem devolver o vídeo.");
  return { externalId: videoId, externalUrl: `https://www.youtube.com/watch?v=${videoId}` };
}
