import "server-only";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integrations/vault";
import type { IntegrationProviderKey } from "@/generated/prisma/enums";
import type { ConnectFamily } from "./networks";

// Credenciais do "app" de cada rede (criado pela agência no painel de desenvolvedores
// da rede). Ficam no cofre de Integrações; aqui só lemos.
export const FAMILY_PROVIDER: Record<ConnectFamily, IntegrationProviderKey> = {
  meta: "META_SOCIAL",
  youtube: "YOUTUBE_PUBLISH",
  tiktok: "TIKTOK_SOCIAL",
  x: "X_SOCIAL",
  threads: "THREADS_SOCIAL",
  linkedin: "LINKEDIN_SOCIAL",
  reddit: "REDDIT_SOCIAL",
};

export interface SocialApp {
  clientId: string;
  clientSecret: string;
  // TikTok: auditoria aprovada (publica como público). Sem isso, só privado.
  audited: boolean;
  // LinkedIn: Community Management API aprovada (páginas de empresa).
  organizations: boolean;
  // Meta: ID de configuração do Login do Facebook para Empresas (opcional).
  configId: string;
  // Reddit: usuário dono do app (vai no User-Agent exigido pelo Reddit).
  redditUser: string;
}

export async function getSocialApp(organizationId: string, family: ConnectFamily): Promise<SocialApp | null> {
  const integration = await db.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider: FAMILY_PROVIDER[family] } },
    include: { credentials: true },
  });
  if (!integration) return null;
  const config = (integration.config as Record<string, string> | null) ?? {};
  const secretRow = integration.credentials.find((c) => c.label === "clientSecret");
  if (!config.clientId || !secretRow) return null;
  return {
    clientId: config.clientId,
    clientSecret: decryptSecret({ encryptedValue: secretRow.encryptedValue, iv: secretRow.iv, authTag: secretRow.authTag }),
    audited: config.audited === "on",
    organizations: config.organizations === "on",
    redditUser: config.redditUser ?? "",
    configId: config.configId ?? "",
  };
}

export function socialRedirectUri(family: ConnectFamily): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/api/social/oauth/${family}/callback`;
}
