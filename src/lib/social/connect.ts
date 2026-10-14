import "server-only";
import { type ConnectFamily, type SocialNetwork } from "./networks";
import { socialRedirectUri, type SocialApp } from "./apps";
import type { TokenBlob } from "./accounts";

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v23.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const GRAPH_THREADS = "https://graph.threads.net";
export const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION ?? "202609";
export const redditAgent = (user: string) => `web:lumibase:1.0 (by /u/${user})`;

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
const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"];
const THREADS_SCOPES = ["threads_basic", "threads_content_publish"];
const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"];
const LINKEDIN_ORG_SCOPES = ["w_organization_social", "r_organization_social", "rw_organization_admin"];
const REDDIT_SCOPES = ["identity", "submit"];

export function buildAuthUrl(family: ConnectFamily, app: SocialApp, state: string, codeChallenge: string): string {
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
  if (family === "tiktok") {
    const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
    u.searchParams.set("client_key", app.clientId);
    u.searchParams.set("scope", TIKTOK_SCOPES.join(","));
    u.searchParams.set("response_type", "code");
    u.searchParams.set("redirect_uri", redirect);
    u.searchParams.set("state", state);
    return u.toString();
  }
  if (family === "x") {
    const u = new URL("https://x.com/i/oauth2/authorize");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", app.clientId);
    u.searchParams.set("redirect_uri", redirect);
    u.searchParams.set("scope", X_SCOPES.join(" "));
    u.searchParams.set("state", state);
    u.searchParams.set("code_challenge", codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
    return u.toString();
  }
  if (family === "threads") {
    const u = new URL("https://threads.net/oauth/authorize");
    u.searchParams.set("client_id", app.clientId);
    u.searchParams.set("redirect_uri", redirect);
    u.searchParams.set("scope", THREADS_SCOPES.join(","));
    u.searchParams.set("response_type", "code");
    u.searchParams.set("state", state);
    return u.toString();
  }
  if (family === "linkedin") {
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", app.clientId);
    u.searchParams.set("redirect_uri", redirect);
    u.searchParams.set("state", state);
    u.searchParams.set("scope", [...LINKEDIN_SCOPES, ...(app.organizations ? LINKEDIN_ORG_SCOPES : [])].join(" "));
    return u.toString();
  }
  const u = new URL("https://www.reddit.com/api/v1/authorize");
  u.searchParams.set("client_id", app.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("duration", "permanent");
  u.searchParams.set("scope", REDDIT_SCOPES.join(" "));
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

async function discoverX(app: SocialApp, code: string, verifier: string): Promise<Candidate[]> {
  const res = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}` },
    body: new URLSearchParams({ code, grant_type: "authorization_code", client_id: app.clientId, redirect_uri: socialRedirectUri("x"), code_verifier: verifier }),
  });
  const tok = await json<{ access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string }>(res);
  if (!res.ok || !tok.access_token) throw new Error(`O X recusou o código: ${tok.error_description ?? tok.error ?? `HTTP ${res.status}`}`);
  const me = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url", { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const meData = await json<{ data?: { id: string; username: string; name: string; profile_image_url?: string } }>(me);
  if (!me.ok || !meData.data) throw new Error("Não consegui ler o perfil do X.");
  const tokens: TokenBlob = { accessToken: tok.access_token, refreshToken: tok.refresh_token, accessExpiresAt: new Date(Date.now() + (tok.expires_in ?? 7200) * 1000).toISOString() };
  return [{ key: `TWITTER:${meData.data.id}`, network: "TWITTER", externalId: meData.data.id, name: `@${meData.data.username}`, avatarUrl: meData.data.profile_image_url ?? null, tokens, meta: { username: meData.data.username } }];
}

async function discoverThreads(app: SocialApp, code: string): Promise<Candidate[]> {
  const res = await fetch(`${GRAPH_THREADS}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: app.clientId, client_secret: app.clientSecret, code, grant_type: "authorization_code", redirect_uri: socialRedirectUri("threads") }),
  });
  const short = await json<{ access_token?: string; user_id?: string | number; error_message?: string }>(res);
  if (!res.ok || !short.access_token) throw new Error(`O Threads recusou o código: ${short.error_message ?? `HTTP ${res.status}`}`);
  const long = await fetch(`${GRAPH_THREADS}/access_token?${new URLSearchParams({ grant_type: "th_exchange_token", client_secret: app.clientSecret, access_token: short.access_token })}`);
  const longData = await json<{ access_token?: string; expires_in?: number }>(long);
  const accessToken = longData.access_token ?? short.access_token;
  const profile = await fetch(`${GRAPH_THREADS}/v1.0/me?${new URLSearchParams({ fields: "id,username,threads_profile_picture_url", access_token: accessToken })}`);
  const p = await json<{ id?: string; username?: string; threads_profile_picture_url?: string }>(profile);
  if (!profile.ok || !p.id) throw new Error("Não consegui ler o perfil do Threads.");
  const tokens: TokenBlob = { accessToken, accessExpiresAt: new Date(Date.now() + (longData.expires_in ?? 5184000) * 1000).toISOString() };
  return [{ key: `THREADS:${p.id}`, network: "THREADS", externalId: p.id, name: p.username ? `@${p.username}` : "Conta do Threads", avatarUrl: p.threads_profile_picture_url ?? null, tokens, meta: {} }];
}

const liHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, "LinkedIn-Version": LINKEDIN_VERSION, "X-Restli-Protocol-Version": "2.0.0" });

async function discoverLinkedin(app: SocialApp, code: string): Promise<Candidate[]> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: socialRedirectUri("linkedin") }),
  });
  const tok = await json<{ access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string }>(res);
  if (!res.ok || !tok.access_token) throw new Error(`O LinkedIn recusou o código: ${tok.error_description ?? tok.error ?? `HTTP ${res.status}`}`);
  const tokens: TokenBlob = { accessToken: tok.access_token, refreshToken: tok.refresh_token, accessExpiresAt: new Date(Date.now() + (tok.expires_in ?? 5184000) * 1000).toISOString() };
  const out: Candidate[] = [];
  const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const meData = await json<{ sub?: string; name?: string; picture?: string }>(me);
  if (me.ok && meData.sub) out.push({ key: `LINKEDIN:person:${meData.sub}`, network: "LINKEDIN", externalId: `urn:li:person:${meData.sub}`, name: `${meData.name ?? "Perfil"} (perfil pessoal)`, avatarUrl: meData.picture ?? null, tokens, meta: { kind: "person" } });
  if (app.organizations) {
    const acl = await fetch("https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED", { headers: liHeaders(tok.access_token) });
    const aclData = await json<{ elements?: { organization?: string }[] }>(acl);
    for (const el of aclData.elements ?? []) {
      const urn = el.organization;
      const id = urn?.split(":").pop();
      if (!urn || !id) continue;
      const org = await fetch(`https://api.linkedin.com/rest/organizations/${id}`, { headers: liHeaders(tok.access_token) });
      const orgData = await json<{ localizedName?: string }>(org);
      out.push({ key: `LINKEDIN:org:${id}`, network: "LINKEDIN", externalId: urn, name: `${orgData.localizedName ?? `Página ${id}`} (página)`, avatarUrl: null, tokens, meta: { kind: "organization" } });
    }
  }
  if (out.length === 0) throw new Error("Não encontrei perfil nem página nesta autorização do LinkedIn.");
  return out;
}

async function discoverReddit(app: SocialApp, code: string): Promise<Candidate[]> {
  const agent = redditAgent(app.redditUser);
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`, "User-Agent": agent },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: socialRedirectUri("reddit") }),
  });
  const tok = await json<{ access_token?: string; refresh_token?: string; expires_in?: number; error?: string }>(res);
  if (!res.ok || !tok.access_token) throw new Error(`O Reddit recusou o código: ${tok.error ?? `HTTP ${res.status}`}`);
  const me = await fetch("https://oauth.reddit.com/api/v1/me", { headers: { Authorization: `Bearer ${tok.access_token}`, "User-Agent": agent } });
  const meData = await json<{ name?: string; icon_img?: string }>(me);
  if (!me.ok || !meData.name) throw new Error("Não consegui ler o perfil do Reddit.");
  const tokens: TokenBlob = { accessToken: tok.access_token, refreshToken: tok.refresh_token, accessExpiresAt: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString() };
  return [{ key: `REDDIT:${meData.name}`, network: "REDDIT", externalId: meData.name, name: `u/${meData.name}`, avatarUrl: meData.icon_img?.split("?")[0] ?? null, tokens, meta: {} }];
}

export async function discoverCandidates(family: ConnectFamily, app: SocialApp, code: string, codeVerifier: string): Promise<Candidate[]> {
  if (family === "meta") return discoverMeta(app, code);
  if (family === "youtube") return discoverYoutube(app, code);
  if (family === "tiktok") return discoverTiktok(app, code);
  if (family === "x") return discoverX(app, code, codeVerifier);
  if (family === "threads") return discoverThreads(app, code);
  if (family === "linkedin") return discoverLinkedin(app, code);
  return discoverReddit(app, code);
}
