import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { decryptSecret } from "@/lib/integrations/vault";
import { getOAuthProviderConfig } from "@/lib/integrations/oauth-providers";
import { exchangeCodeForTokens, storeOAuthTokens } from "@/lib/integrations/oauth-tokens";
import { verifyOAuthState } from "@/lib/integrations/oauth-state";
import type { IntegrationProviderKey } from "@/generated/prisma/enums";

const OAUTH_STATE_COOKIE = "lumihub_oauth_state";

function redirectWithMessage(request: NextRequest, kind: "success" | "error", message: string) {
  const url = new URL("/configuracoes/integracoes", request.url);
  url.searchParams.set("oauth", kind);
  url.searchParams.set("message", message);
  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  const provider = providerParam as IntegrationProviderKey;
  const oauthConfig = getOAuthProviderConfig(provider);
  if (!oauthConfig) {
    return redirectWithMessage(request, "error", "Provedor não suporta OAuth.");
  }

  const { searchParams } = request.nextUrl;
  const providerError = searchParams.get("error");
  if (providerError) {
    const description = searchParams.get("error_description") ?? providerError;
    return redirectWithMessage(request, "error", `Conexão cancelada pelo provedor: ${description}`);
  }

  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !returnedState || !cookieState || returnedState !== cookieState) {
    return redirectWithMessage(request, "error", "Estado da conexão inválido ou expirado. Tente conectar novamente.");
  }

  const statePayload = verifyOAuthState(returnedState);
  if (!statePayload || statePayload.provider !== provider) {
    return redirectWithMessage(request, "error", "Estado da conexão inválido ou expirado. Tente conectar novamente.");
  }

  const integration = await db.integration.findUnique({
    where: { organizationId_provider: { organizationId: statePayload.organizationId, provider } },
  });
  const config = (integration?.config as Record<string, string> | null) ?? {};
  const clientId = config.clientId;
  const clientSecretRow = integration
    ? await db.integrationCredential.findFirst({ where: { integrationId: integration.id, label: "clientSecret" } })
    : null;

  if (!integration || !clientId || !clientSecretRow) {
    return redirectWithMessage(request, "error", "Client ID/Secret não encontrados. Salve as credenciais antes de conectar.");
  }

  const clientSecret = decryptSecret(clientSecretRow);

  try {
    const tokens = await exchangeCodeForTokens(provider, {
      clientId,
      clientSecret,
      code,
      codeVerifier: statePayload.codeVerifier,
    });

    await storeOAuthTokens(integration.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });

    const accountLabel = await oauthConfig.fetchAccountLabel(tokens.access_token).catch(() => null);
    const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    await db.integration.update({
      where: { id: integration.id },
      data: {
        status: "CONECTADO",
        connectedAt: new Date(),
        connectedByUserId: statePayload.userId,
        config: { ...config, tokenExpiresAt, ...(accountLabel ? { accountLabel } : {}) },
      },
    });

    await db.integrationLog.create({
      data: {
        organizationId: statePayload.organizationId,
        integrationId: integration.id,
        direction: "ENTRADA",
        eventType: "OAUTH_CALLBACK",
        status: "SUCESSO",
      },
    });

    await audit({
      organizationId: statePayload.organizationId,
      userId: statePayload.userId,
      action: "INTEGRATION_CONNECTED",
      entityType: "Integration",
      entityId: integration.id,
      metadata: { provider, via: "oauth", accountLabel },
    });

    return redirectWithMessage(
      request,
      "success",
      accountLabel ? `${oauthConfig.label} conectado (${accountLabel}).` : `${oauthConfig.label} conectado.`,
    );
  } catch (err) {
    const message = (err as Error).message;

    await db.integration.update({ where: { id: integration.id }, data: { status: "ERRO" } });
    await db.integrationLog.create({
      data: {
        organizationId: statePayload.organizationId,
        integrationId: integration.id,
        direction: "ENTRADA",
        eventType: "OAUTH_CALLBACK",
        status: "FALHA",
        errorMessage: message,
      },
    });

    return redirectWithMessage(request, "error", message);
  }
}
