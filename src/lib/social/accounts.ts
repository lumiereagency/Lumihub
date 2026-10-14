import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/integrations/vault";
import { getSocialApp } from "./apps";
import type { SocialAccount } from "@/generated/prisma/client";

export interface TokenBlob {
  accessToken: string;
  refreshToken?: string;
  // ISO: quando o access token vence (Google e TikTok renovam; Meta de página não vence).
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

// Devolve um access token válido (renova sozinho no Google e no TikTok).
export async function getAccessToken(account: SocialAccount): Promise<string> {
  const blob = openTokens(account);
  const expires = blob.accessExpiresAt ? new Date(blob.accessExpiresAt).getTime() : null;
  if (account.network !== "YOUTUBE" && account.network !== "TIKTOK") return blob.accessToken;
  if (expires === null || expires - Date.now() > 120_000) return blob.accessToken;
  if (!blob.refreshToken) {
    await markAccount(account.id, "EXPIRADA", "A conexão venceu. Reconecte a conta do cliente.");
    throw new Error("A conexão da conta venceu. Reconecte a conta do cliente.");
  }
  const family = account.network === "YOUTUBE" ? "youtube" : "tiktok";
  const app = await getSocialApp(account.organizationId, family);
  if (!app) throw new Error("As credenciais do app não estão mais no cofre de Integrações.");
  try {
    const res =
      family === "youtube"
        ? await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: blob.refreshToken, client_id: app.clientId, client_secret: app.clientSecret }),
          })
        : await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: blob.refreshToken, client_key: app.clientId, client_secret: app.clientSecret }),
          });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!res.ok || !data.access_token) throw new Error(data.error_description ?? data.error ?? `HTTP ${res.status}`);
    const next: TokenBlob = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? blob.refreshToken,
      accessExpiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    };
    const sealed = sealTokens(next);
    await db.socialAccount.update({ where: { id: account.id }, data: { tokenEnc: sealed.encryptedValue, tokenIv: sealed.iv, tokenTag: sealed.authTag, status: "ATIVA", statusMessage: null } });
    return next.accessToken;
  } catch (e) {
    await markAccount(account.id, "EXPIRADA", "A conexão foi revogada ou venceu. Reconecte a conta do cliente.");
    throw new Error(`Não consegui renovar a conexão: ${(e as Error).message}`);
  }
}

export function readTokens(account: SocialAccount): TokenBlob {
  return openTokens(account);
}
