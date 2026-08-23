import "server-only";
import { db } from "@/lib/db";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/integrations/vault";
import { getOAuthProviderConfig, oauthRedirectUri } from "@/lib/integrations/oauth-providers";
import type { IntegrationProviderKey } from "@/generated/prisma/enums";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

async function postToken(tokenEndpoint: string, params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    const reason = data.error_description ?? data.error ?? `HTTP ${res.status}`;
    throw new Error(`O provedor recusou a troca de código por token: ${reason}`);
  }
  return data;
}

export async function exchangeCodeForTokens(
  provider: IntegrationProviderKey,
  params: { clientId: string; clientSecret: string; code: string; codeVerifier: string },
): Promise<TokenResponse> {
  const config = getOAuthProviderConfig(provider);
  if (!config) throw new Error("Provedor não suporta OAuth.");

  return postToken(config.tokenEndpoint, {
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: oauthRedirectUri(provider),
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code_verifier: params.codeVerifier,
  });
}

async function refreshAccessToken(
  provider: IntegrationProviderKey,
  params: { clientId: string; clientSecret: string; refreshToken: string },
): Promise<TokenResponse> {
  const config = getOAuthProviderConfig(provider);
  if (!config) throw new Error("Provedor não suporta OAuth.");

  return postToken(config.tokenEndpoint, {
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    scope: config.scope,
  });
}

// Substitui só as credenciais de token (accessToken/refreshToken), preservando
// o clientSecret já salvo — necessário para futuros refreshes.
export async function storeOAuthTokens(
  integrationId: string,
  tokens: { accessToken: string; refreshToken?: string },
): Promise<void> {
  await db.integrationCredential.deleteMany({
    where: { integrationId, label: { in: ["accessToken", "refreshToken"] } },
  });

  const rows: { integrationId: string; label: string; encryptedValue: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer>; authTag: Uint8Array<ArrayBuffer>; maskedPreview: string }[] = [];
  const access = encryptSecret(tokens.accessToken);
  rows.push({ integrationId, label: "accessToken", ...access, maskedPreview: maskSecret(tokens.accessToken) });

  if (tokens.refreshToken) {
    const refresh = encryptSecret(tokens.refreshToken);
    rows.push({ integrationId, label: "refreshToken", ...refresh, maskedPreview: maskSecret(tokens.refreshToken) });
  }

  await db.integrationCredential.createMany({ data: rows });
}

async function getCredential(integrationId: string, label: string): Promise<string | null> {
  const row = await db.integrationCredential.findFirst({ where: { integrationId, label } });
  if (!row) return null;
  return decryptSecret(row);
}

// Retorna um access token válido para chamar a API do provedor, renovando via
// refresh token quando expirado (sem cron — sob demanda, no momento do uso,
// mesmo princípio "honesto" já usado na régua de cobrança e nos alertas). Se o
// refresh falhar (token revogado pelo usuário no provedor, por exemplo), marca
// a integração como EXPIRADO com o motivo real em vez de devolver um token
// inválido silenciosamente.
export async function getValidOAuthAccessToken(integrationId: string): Promise<string> {
  const integration = await db.integration.findUniqueOrThrow({ where: { id: integrationId } });
  const config = (integration.config as Record<string, string> | null) ?? {};

  const expiresAt = config.tokenExpiresAt ? new Date(config.tokenExpiresAt) : null;
  const stillValid = expiresAt && expiresAt.getTime() - Date.now() > 60_000;

  const accessToken = await getCredential(integrationId, "accessToken");
  if (stillValid && accessToken) return accessToken;

  const clientId = config.clientId;
  const clientSecret = await getCredential(integrationId, "clientSecret");
  const refreshToken = await getCredential(integrationId, "refreshToken");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Conexão OAuth incompleta — reconecte em Configurações → Integrações.");
  }

  try {
    const tokens = await refreshAccessToken(integration.provider, { clientId, clientSecret, refreshToken });
    await storeOAuthTokens(integrationId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
    });
    await db.integration.update({
      where: { id: integrationId },
      data: {
        status: "CONECTADO",
        config: { ...config, tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString() },
      },
    });
    return tokens.access_token;
  } catch (err) {
    await db.integration.update({ where: { id: integrationId }, data: { status: "EXPIRADO" } });
    throw new Error(`Não foi possível renovar a conexão: ${(err as Error).message}`);
  }
}
