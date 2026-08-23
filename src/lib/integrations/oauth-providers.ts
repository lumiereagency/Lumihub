import "server-only";
import type { IntegrationProviderKey } from "@/generated/prisma/enums";

export interface OAuthProviderConfig {
  label: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scope: string;
  // Parâmetros extras específicos do provedor na URL de autorização (ex.: forçar
  // o Google a sempre emitir um refresh_token, mesmo em reautorizações).
  extraAuthParams?: Record<string, string>;
  // Busca a identidade da conta conectada (e-mail) para exibir na UI — nunca
  // gravamos o access token em texto puro nem confiamos nele sem essa checagem.
  fetchAccountLabel: (accessToken: string) => Promise<string | null>;
}

async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

async function fetchMicrosoftAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return data.mail ?? data.userPrincipalName ?? null;
}

export const OAUTH_PROVIDERS: Partial<Record<IntegrationProviderKey, OAuthProviderConfig>> = {
  GOOGLE_CALENDAR: {
    label: "Google Calendar",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    fetchAccountLabel: fetchGoogleAccountEmail,
  },
  GOOGLE_DRIVE: {
    label: "Google Drive",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    fetchAccountLabel: fetchGoogleAccountEmail,
  },
  OUTLOOK_CALENDAR: {
    label: "Outlook Calendar",
    authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access openid email",
    fetchAccountLabel: fetchMicrosoftAccountEmail,
  },
};

export function getOAuthProviderConfig(key: IntegrationProviderKey): OAuthProviderConfig | undefined {
  return OAUTH_PROVIDERS[key];
}

export function oauthRedirectUri(provider: IntegrationProviderKey): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/api/integrations/oauth/${provider}/callback`;
}
