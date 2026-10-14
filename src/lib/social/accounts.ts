import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/integrations/vault";
import { getSocialApp, type SocialApp } from "./apps";
import { GRAPH_THREADS } from "./connect";
import type { SocialAccount } from "@/generated/prisma/client";

export interface TokenBlob {
  accessToken: string;
  refreshToken?: string;
  // ISO: quando o access token vence. Meta (páginas do Facebook e Instagram) não vence.
  accessExpiresAt?: string;
}

export function sealTokens(blob: TokenBlob) {
  return encryptSecret(JSON.stringify(blob));
}

function openTokens(account: Pick<SocialAccount, "tokenEnc" | "tokenIv" | "tokenTag">): TokenBlob {
  return JSON.parse(decryptSecret({ encryptedValue: account.tokenEnc, iv: account.tokenIv, authTag: account.tokenTag })) as TokenBlob;
}

async function markAccount(accountId: string, status: "ATIVA" | "EXPIRADA" | "ERRO", message: string | null) {
  await db.socialAccount.update({ where: { id: accountId }, data: { status, statusMessage: message } });
}

const basic = (app: SocialApp) => `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`;
const form = (data: Record<string, string>) => new URLSearchParams(data);
const FORM = { "Content-Type": "application/x-www-form-urlencoded" };

type Refreshed = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };

async function requestRefresh(network: string, blob: TokenBlob, app: SocialApp): Promise<Refreshed> {
  const refresh = blob.refreshToken ?? "";
  let res: Response;
  switch (network) {
    case "YOUTUBE":
      res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: FORM, body: form({ grant_type: "refresh_token", refresh_token: refresh, client_id: app.clientId, client_secret: app.clientSecret }) });
      break;
    case "TIKTOK":
      res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: FORM, body: form({ grant_type: "refresh_token", refresh_token: refresh, client_key: app.clientId, client_secret: app.clientSecret }) });
      break;
    case "TWITTER":
      res = await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers: { ...FORM, Authorization: basic(app) }, body: form({ grant_type: "refresh_token", refresh_token: refresh, client_id: app.clientId }) });
      break;
    case "REDDIT":
      res = await fetch("https://www.reddit.com/api/v1/access_token", { method: "POST", headers: { ...FORM, Authorization: basic(app), "User-Agent": `web:lumibase:1.0 (by /u/${app.redditUser})` }, body: form({ grant_type: "refresh_token", refresh_token: refresh }) });
      break;
    case "LINKEDIN":
      res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: FORM, body: form({ grant_type: "refresh_token", refresh_token: refresh, client_id: app.clientId, client_secret: app.clientSecret }) });
      break;
    case "THREADS":
      // O Threads renova o próprio token de longa duração (válido por 60 dias).
      res = await fetch(`${GRAPH_THREADS}/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: blob.accessToken })}`);
      break;
    default:
      throw new Error("Rede sem renovação de token.");
  }
  const data = (await res.json().catch(() => ({}))) as Refreshed;
  if (!res.ok || !data.access_token) throw new Error(data.error_description ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

const FAMILY_OF: Record<string, "youtube" | "tiktok" | "x" | "reddit" | "linkedin" | "threads"> = { YOUTUBE: "youtube", TIKTOK: "tiktok", TWITTER: "x", REDDIT: "reddit", LINKEDIN: "linkedin", THREADS: "threads" };
// Quanto tempo antes do vencimento renovamos.
const RENEW_BEFORE_MS: Record<string, number> = { THREADS: 20 * 86400_000, LINKEDIN: 7 * 86400_000 };

// Devolve um access token válido, renovando sozinho quando a rede permite.
export async function getAccessToken(account: SocialAccount): Promise<string> {
  const blob = openTokens(account);
  const family = FAMILY_OF[account.network];
  if (!family) return blob.accessToken; // Facebook e Instagram: token de página não vence
  const expires = blob.accessExpiresAt ? new Date(blob.accessExpiresAt).getTime() : null;
  if (expires === null) return blob.accessToken;
  const margin = RENEW_BEFORE_MS[account.network] ?? 120_000;
  if (expires - Date.now() > margin) return blob.accessToken;

  const canRefresh = account.network === "THREADS" ? expires > Date.now() : !!blob.refreshToken;
  if (!canRefresh) {
    if (expires > Date.now()) return blob.accessToken; // ainda vale, só não dá para renovar
    await markAccount(account.id, "EXPIRADA", "A conexão venceu. Reconecte a conta do cliente.");
    throw new Error("A conexão da conta venceu. Reconecte a conta do cliente.");
  }
  const app = await getSocialApp(account.organizationId, family);
  if (!app) throw new Error("As credenciais do app não estão mais no cofre de Integrações.");
  try {
    const data = await requestRefresh(account.network, blob, app);
    const accessExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
    const next: TokenBlob = { accessToken: data.access_token!, refreshToken: data.refresh_token ?? blob.refreshToken, accessExpiresAt };
    const sealed = sealTokens(next);
    await db.socialAccount.update({ where: { id: account.id }, data: { tokenEnc: sealed.encryptedValue, tokenIv: sealed.iv, tokenTag: sealed.authTag, expiresAt: new Date(accessExpiresAt), status: "ATIVA", statusMessage: null } });
    return next.accessToken;
  } catch (e) {
    await markAccount(account.id, "EXPIRADA", "A conexão foi revogada ou venceu. Reconecte a conta do cliente.");
    throw new Error(`Não consegui renovar a conexão: ${(e as Error).message}`);
  }
}

export function readTokens(account: SocialAccount): TokenBlob {
  return openTokens(account);
}
