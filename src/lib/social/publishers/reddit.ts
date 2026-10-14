import "server-only";
import { imageBytes, imageMime } from "./media";
import { PublishError, sleep, type PublishInput, type PublishResult } from "./types";

const API = "https://oauth.reddit.com";

type RedditJson = { json?: { errors?: [string, string, string?][]; data?: { url?: string; id?: string; name?: string; websocket_url?: string } } };

async function reddit<T>(path: string, i: PublishInput, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${i.accessToken}`, "User-Agent": i.redditAgent ?? "web:lumibase:1.0", ...(init.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new PublishError(`Reddit: ${(data as { message?: string }).message ?? `HTTP ${res.status}`}`, res.status === 401 || res.status === 403);
  return data;
}

// "r/marca", "/r/marca" ou "marca" → "marca"; "u/nome" → "u_nome" (perfil do usuário).
export function normalizeSubreddit(raw: string | null, fallbackUser: string): string {
  const v = (raw ?? "").trim();
  if (!v) return `u_${fallbackUser}`;
  const user = v.match(/^\/?u\/(.+)$/i);
  if (user) return `u_${user[1]}`;
  return v.replace(/^\/?r\//i, "");
}

function failIfErrors(data: RedditJson) {
  const errors = data.json?.errors ?? [];
  if (errors.length === 0) return;
  const [code, message] = errors[0];
  // Limite de frequência passa sozinho; o resto (comunidade inexistente, proibida, regras) precisa de gente.
  throw new PublishError(`Reddit: ${message || code}`, !/RATELIMIT/i.test(code));
}

async function uploadImage(i: PublishInput, idx: number): Promise<string> {
  const item = i.media[idx];
  const mime = imageMime(item);
  const lease = await reddit<{ args?: { action?: string; fields?: { name: string; value: string }[] } }>("/api/media/asset.json?raw_json=1", i, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ filepath: `post.${mime.split("/")[1]}`, mimetype: mime }),
  });
  const action = lease.args?.action;
  const fields = lease.args?.fields ?? [];
  if (!action) throw new PublishError("Reddit: não consegui reservar o envio da imagem.");
  const body = new FormData();
  for (const f of fields) body.set(f.name, f.value);
  body.set("file", new Blob([new Uint8Array(await imageBytes(i, item))], { type: mime }), `post.${mime.split("/")[1]}`);
  const url = action.startsWith("//") ? `https:${action}` : action;
  const up = await fetch(url, { method: "POST", body });
  if (!up.ok) throw new PublishError(`Reddit: o envio da imagem falhou (HTTP ${up.status}).`);
  const key = fields.find((f) => f.name === "key")?.value;
  return `${url.replace(/\/$/, "")}/${key}`;
}

export async function publishReddit(i: PublishInput): Promise<PublishResult> {
  const sr = normalizeSubreddit(i.subreddit, i.account.externalId);
  const title = i.title.trim().slice(0, 300);
  const text = i.caption.trim();
  const image = i.media.findIndex((m) => m.kind === "image" && m.storageKey);
  const params: Record<string, string> = { api_type: "json", sr, title, resubmit: "true", sendreplies: "true" };
  if (image >= 0) {
    params.kind = "image";
    params.url = await uploadImage(i, image);
  } else {
    params.kind = "self";
    params.text = text;
  }
  const data = await reddit<RedditJson>("/api/submit", i, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  failIfErrors(data);
  const d = data.json?.data;
  if (d?.url) return { externalId: d.name ?? d.id ?? d.url, externalUrl: d.url };
  // Post de imagem: o Reddit avisa por websocket; procuramos o post recém-criado no perfil.
  await sleep(6000);
  const mine = await reddit<{ data?: { children?: { data?: { title?: string; permalink?: string; name?: string; created_utc?: number } }[] } }>(`/user/${i.account.externalId}/submitted?limit=5&raw_json=1`, i);
  const found = mine.data?.children?.map((c) => c.data).find((p) => p?.title === title && (p.created_utc ?? 0) * 1000 > Date.now() - 10 * 60_000);
  return { externalId: found?.name ?? d?.id ?? `reddit-${Date.now()}`, externalUrl: found?.permalink ? `https://www.reddit.com${found.permalink}` : null };
}
