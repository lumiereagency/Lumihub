import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getOAuthProviderConfig, oauthRedirectUri } from "@/lib/integrations/oauth-providers";
import { createOAuthState, generateCodeVerifier, codeChallengeFromVerifier } from "@/lib/integrations/oauth-state";
import type { IntegrationProviderKey } from "@/generated/prisma/enums";

const OAUTH_STATE_COOKIE = "lumihub_oauth_state";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!hasPermission(user, permKey("INTEGRATIONS", "MANAGE"))) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  const { provider: providerParam } = await params;
  const provider = providerParam as IntegrationProviderKey;
  const oauthConfig = getOAuthProviderConfig(provider);
  if (!oauthConfig) {
    return new NextResponse("Provedor não suporta OAuth.", { status: 404 });
  }

  const integration = await db.integration.findUnique({
    where: { organizationId_provider: { organizationId: user.organizationId, provider } },
  });
  const config = (integration?.config as Record<string, string> | null) ?? {};
  const clientId = config.clientId;
  if (!integration || !clientId) {
    const url = new URL("/configuracoes/integracoes", request.url);
    url.searchParams.set("oauth", "error");
    url.searchParams.set("message", "Salve o Client ID e o Client Secret antes de conectar via OAuth.");
    return NextResponse.redirect(url);
  }

  const codeVerifier = generateCodeVerifier();
  const state = createOAuthState({
    provider,
    organizationId: user.organizationId,
    userId: user.id,
    codeVerifier,
  });

  const authUrl = new URL(oauthConfig.authorizationEndpoint);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", oauthRedirectUri(provider));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", oauthConfig.scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallengeFromVerifier(codeVerifier));
  authUrl.searchParams.set("code_challenge_method", "S256");
  for (const [key, value] of Object.entries(oauthConfig.extraAuthParams ?? {})) {
    authUrl.searchParams.set(key, value);
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
