import "server-only";
import { GRAPH_THREADS } from "../connect";
import { driveFileId } from "../drive";
import { publicImageUrl, signedMediaUrl } from "../media-url";
import { PublishError, sleep, type PublishInput, type PublishResult } from "./types";

const API = `${GRAPH_THREADS}/v1.0`;

async function call(method: "GET" | "POST", path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params);
  const res = await fetch(method === "GET" ? `${API}/${path}?${qs}` : `${API}/${path}`, method === "POST" ? { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs } : undefined);
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_user_msg?: string } } & Record<string, unknown>;
  if (!res.ok || data.error) {
    const permanent = [190, 10, 200].includes(data.error?.code ?? 0);
    throw new PublishError(`Threads: ${data.error?.error_user_msg ?? data.error?.message ?? `HTTP ${res.status}`}`, permanent);
  }
  return data;
}

// O Threads processa a mídia depois do envio: esperamos o contêiner ficar pronto.
async function waitReady(container: string, token: string, seconds: number) {
  await sleep(5000);
  for (let n = 0; n < Math.ceil(seconds / 5); n++) {
    const s = await call("GET", container, { fields: "status,error_message", access_token: token });
    const status = String(s.status ?? "");
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new PublishError(`Threads: o processamento falhou${s.error_message ? ` (${String(s.error_message)})` : ""}.`, true);
    await sleep(5000);
  }
  throw new PublishError("Threads: a mídia demorou demais para ficar pronta. Tentaremos de novo.");
}

function mediaParams(i: PublishInput, idx: number): Record<string, string> {
  const m = i.media[idx];
  if (m.kind === "video") {
    if (!driveFileId(m.url)) throw new PublishError("Os vídeos precisam ser links do Google Drive.", true);
    return { media_type: "VIDEO", video_url: signedMediaUrl(i.targetId, idx) };
  }
  return { media_type: "IMAGE", image_url: publicImageUrl(i.batchToken, i.postId, idx) };
}

export async function publishThreads(i: PublishInput): Promise<PublishResult> {
  const user = i.account.externalId;
  const token = i.accessToken;
  const text = (i.caption.trim() || i.title).slice(0, 500);
  let container: string;
  if (i.media.length === 1) {
    const p = mediaParams(i, 0);
    const c = await call("POST", `${user}/threads`, { ...p, text, access_token: token });
    container = String(c.id);
    await waitReady(container, token, p.media_type === "VIDEO" ? 300 : 60);
  } else {
    const children: string[] = [];
    for (let idx = 0; idx < Math.min(i.media.length, 20); idx++) {
      const p = mediaParams(i, idx);
      const c = await call("POST", `${user}/threads`, { ...p, is_carousel_item: "true", access_token: token });
      children.push(String(c.id));
      await waitReady(String(c.id), token, p.media_type === "VIDEO" ? 300 : 60);
    }
    const parent = await call("POST", `${user}/threads`, { media_type: "CAROUSEL", children: children.join(","), text, access_token: token });
    container = String(parent.id);
    await waitReady(container, token, 60);
  }
  const published = await call("POST", `${user}/threads_publish`, { creation_id: container, access_token: token });
  const id = String(published.id);
  const info = await call("GET", id, { fields: "permalink", access_token: token }).catch(() => ({}) as Record<string, unknown>);
  return { externalId: id, externalUrl: typeof info.permalink === "string" ? info.permalink : null };
}
