import "server-only";
import { type ConnectFamily, type SocialNetwork } from "./networks";
import { socialRedirectUri, type SocialApp } from "./apps";
import type { TokenBlob } from "./accounts";

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v23.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Uma conta que o usuário pode ligar ao cliente depois do consentimento.
export interface Candidate {
  key: string;
  network: SocialNetwork;
  externalId: string;
  name: string;
  avatarUrl: string | null;
  tokens: TokenBlob;
  meta: Record<string, string>;
}

const META_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish", "business_management"];
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
const TIKTOK_SCOPES = ["user.info.basic", "video.publish"];

export function buildAuthUrl(family: ConnectFamily, app: SocialApp, state: string): string {
  const redirect = socialRedirectUri(family);
  if (family === "meta") {
    const u = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    u.searchParams.set("client_id", app.clientId);
    u.searchParams.set("redirect_uri", redirect);
    u.searchParams.set("state", state);
    u.searchParams.set("scope", META_SCOPES.join(","));
    u.searchParams.set("response_type", "code");
    return u.toString();
  }
  if (family === "youtube") {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", app.clientId);
    u.searchParams.set("redirect_uri", redirect);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
    u.searchParams.set("state", state);
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent select_account");
    return u.toString();
  }
  const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
  u.searchParams.set("client_key", app.clientId);
  u.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("state", state);
  return u.toString();
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

function graphError(data: unknown, status: number): string {
  const e = (data as { error?: { message?: string } })?.error;
  return e?.message ?? `HTTP ${status}`;
}

async function discoverMeta(app: SocialApp, code: string): Promise<Candidate[]> {
  const short = await fetch(`${GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: socialRedirectUri("meta"), code })}`);
  const shortData = await json<{ access_token?: string }>(short);
  if (!short.ok || !shortData.access_token) throw new Error(`O Facebook recusou o código: ${graphError(shortData, short.status)}`);
  const long = await fetch(`${GRAPH}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: app.clientId, client_secret: app.clientSecret, fb_exchange_token: shortData.access_token })}`);
  const longData = await json<{ access_token?: string }>(long);
  const userToken = longData.access_token ?? shortData.access_token;

  const out: Candidate[] = [];
  let next: string | null = `${GRAPH}/me/accounts?${new URLSearchParams({ fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}", limit: "100", access_token: userToken })}`;
  for (let page = 0; next && page < 5; page++) {
    const res: Response = await fetch(next);
    const data = await json<{ data?: { id: string; name: string; access_token?: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string; username?: string; profile_picture_url?: string } }[]; paging?: { next?: string }; error?: unknown }>(res);
    if (!res.ok) throw new Error(`Não consegui listar as páginas: ${graphError(data, res.status)}`);
    for (const p of data.data ?? []) {
      if (!p.access_token) continue;
      out.push({ key: `FACEBOOK:${p.id}`, network: "FACEBOOK", externalId: p.id, name: p.name, avatarUrl: p.picture?.data?.url ?? null, tokens: { accessToken: p.access_token }, meta: {} });
      if (p.instagram_business_account) {
        const ig = p.instagram_business_account;
        out.push({ key: `INSTAGRAM:${ig.id}`, network: "INSTAGRAM", externalId: ig.id, name: ig.username ? `@${ig.username}` : p.name, avatarUrl: ig.profile_picture_url ?? null, tokens: { accessToken: p.access_token }, meta: { pageId: p.id } });
      }
    }
    next = data.paging?.next ?? null;
  }
  return out;
}

async function discoverYoutube(app: SocialApp, code: string): Promise<Candidate[]> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: socialRedirectUri("youtube") }),
  });
  const tok = await json<{ access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string }>(res);
  if (!res.ok || !tok.access_token) throw new Error(`O Google recusou o código: ${tok.error_description ?? tok.error ?? `HTTP ${res.status}`}`);
  if (!tok.refresh_token) throw new Error("O Google não devolveu a autorização permanente. Remova o acesso do app na conta Google e conecte de novo.");
  const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const chData = await json<{ items?: { id: string; snippet: { title: string; thumbnails?: { default?: { url?: string } } } }[]; error?: { message?: string } }>(ch);
  if (!ch.ok) throw new Error(`Não consegui ler o canal: ${chData.error?.message ?? `HTTP ${ch.status}`}`);
  const tokens: TokenBlob = { accessToken: tok.access_token, refreshToken: tok.refresh_token, accessExpiresAt: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString() };
  return (chData.items ?? []).map((c) => ({ key: `YOUTUBE:${c.id}`, network: "YOUTUBE" as const, externalId: c.id, name: c.snippet.title, avatarUrl: c.snippet.thumbnails?.default?.url ?? null, tokens, meta: {} }));
}

async function discoverTiktok(app: SocialApp, code: string): Promise<Candidate[]> {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: app.clientId, client_secret: app.clientSecret, code, grant_type: "authorization_code", redirect_uri: socialRedirectUri("tiktok") }),
  });
  const tok = await json<{ access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string; error_description?: string; error?: string }>(res);
  if (!res.ok || !tok.access_token || !tok.open_id) throw new Error(`O TikTok recusou o código: ${tok.error_description ?? tok.error ?? `HTTP ${res.status}`}`);
  const info = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const infoData = await json<{ data?: { user?: { display_name?: string; avatar_url?: string } } }>(info);
  const tokens: TokenBlob = { accessToken: tok.access_token, refreshToken: tok.refresh_token, accessExpiresAt: new Date(Date.now() + (tok.expires_in ?? 86400) * 1000).toISOString() };
  return [{ key: `TIKTOK:${tok.open_id}`, network: "TIKTOK", externalId: tok.open_id, name: infoData.data?.user?.display_name ?? "Conta do TikTok", avatarUrl: infoData.data?.user?.avatar_url ?? null, tokens, meta: {} }];
}

export async function discoverCandidates(family: ConnectFamily, app: SocialApp, code: string): Promise<Candidate[]> {
  if (family === "meta") return discoverMeta(app, code);
  if (family === "youtube") return discoverYoutube(app, code);
  return discoverTiktok(app, code);
}
