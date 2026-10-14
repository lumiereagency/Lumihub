import "server-only";
import { driveFileId } from "../drive";
import { driveSize, planChunks, sendDriveInChunks } from "./stream";
import { PublishError, sleep, type PublishInput, type PublishResult } from "./types";

const API = "https://open.tiktokapis.com/v2";
const CHUNK = 10 * 1024 * 1024;

async function tt<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string }; data?: unknown };
  if (!res.ok || (data.error && data.error.code !== "ok")) {
    const code = data.error?.code ?? `HTTP ${res.status}`;
    throw new PublishError(`TikTok: ${data.error?.message || code}`, ["access_token_invalid", "scope_not_authorized", "spam_risk_too_many_posts", "reached_active_user_cap", "unaudited_client_can_only_post_to_private_accounts"].includes(code));
  }
  return data as T;
}

export async function publishTiktok(i: PublishInput): Promise<PublishResult> {
  const video = i.media.find((m) => m.kind === "video");
  const fileId = video ? driveFileId(video.url) : null;
  if (!fileId) throw new PublishError("O TikTok precisa de um vídeo do Google Drive.", true);
  const size = await driveSize(fileId);

  const creator = await tt<{ data?: { privacy_level_options?: string[] } }>("/post/publish/creator_info/query/", i.accessToken, {});
  const options = creator.data?.privacy_level_options ?? [];
  // Sem a auditoria do TikTok, só é permitido publicar como privado.
  const privacy = i.tiktokAudited && options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : options.includes("SELF_ONLY") ? "SELF_ONLY" : (options[0] ?? "SELF_ONLY");

  const plan = size < 5 * 1024 * 1024 ? [size] : planChunks(size, CHUNK);
  const init = await tt<{ data?: { publish_id?: string; upload_url?: string } }>("/post/publish/video/init/", i.accessToken, {
    post_info: { title: i.caption.slice(0, 2200), privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false },
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: plan[0], total_chunk_count: plan.length },
  });
  const publishId = init.data?.publish_id;
  const uploadUrl = init.data?.upload_url;
  if (!publishId || !uploadUrl) throw new PublishError("TikTok: não devolveu o endereço de envio.");

  await sendDriveInChunks(fileId, plan, async (chunk, start, end) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(chunk.length), "Content-Range": `bytes ${start}-${end}/${size}` },
      body: new Uint8Array(chunk),
    });
    if (!res.ok && res.status !== 206) throw new PublishError(`TikTok: o envio falhou (HTTP ${res.status}).`);
  });

  for (let n = 0; n < 30; n++) {
    const s = await tt<{ data?: { status?: string; fail_reason?: string; publicaly_available_post_id?: string[] } }>("/post/publish/status/fetch/", i.accessToken, { publish_id: publishId });
    const status = s.data?.status;
    if (status === "PUBLISH_COMPLETE") {
      const postId = s.data?.publicaly_available_post_id?.[0];
      return { externalId: publishId, externalUrl: postId ? `https://www.tiktok.com/@/video/${postId}` : null };
    }
    if (status === "FAILED") throw new PublishError(`TikTok: ${s.data?.fail_reason ?? "a publicação falhou"}.`, true);
    await sleep(10_000);
  }
  throw new PublishError("TikTok: a publicação ainda não terminou. Confira no app do TikTok.");
}
