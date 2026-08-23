import "server-only";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integrations/vault";
import type { IntegrationProviderKey } from "@/generated/prisma/enums";

// Ordem de preferência quando mais de um provedor de IA está conectado.
export const AI_PROVIDER_PRIORITY: IntegrationProviderKey[] = ["ANTHROPIC", "OPENAI", "GOOGLE_GEMINI"];

export interface ConnectedAiProvider {
  provider: IntegrationProviderKey;
  apiKey: string;
}

// Nunca inventa uma conexão: só retorna um provedor cuja Integration está
// CONECTADO de verdade (Fase 14) e cuja chave foi descriptografada do Vault.
export async function getConnectedAiProvider(organizationId: string): Promise<ConnectedAiProvider | null> {
  const integrations = await db.integration.findMany({
    where: { organizationId, provider: { in: AI_PROVIDER_PRIORITY }, status: "CONECTADO" },
    include: { credentials: true },
  });

  for (const provider of AI_PROVIDER_PRIORITY) {
    const integration = integrations.find((i) => i.provider === provider);
    if (!integration) continue;
    const apiKeyCredential = integration.credentials.find((c) => c.label === "apiKey");
    if (!apiKeyCredential) continue;
    return {
      provider,
      apiKey: decryptSecret({
        encryptedValue: apiKeyCredential.encryptedValue,
        iv: apiKeyCredential.iv,
        authTag: apiKeyCredential.authTag,
      }),
    };
  }
  return null;
}
