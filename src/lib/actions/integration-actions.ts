"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { getProviderDefinition } from "@/lib/integrations/providers";
import { disconnectWhatsAppSession } from "@/lib/integrations/whatsapp-baileys";
import { verifyIntegration } from "@/lib/integrations/verifiers";
import { encryptSecret, maskSecret } from "@/lib/integrations/vault";
import type { ActionState } from "@/lib/actions/auth-actions";
import type { IntegrationProviderKey } from "@/generated/prisma/enums";

export async function connectIntegrationAction(providerKey: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("INTEGRATIONS", "MANAGE"));

  const provider = getProviderDefinition(providerKey as IntegrationProviderKey);
  if (!provider) return { error: "Provedor desconhecido." };

  const values: Record<string, string> = {};
  for (const field of provider.fields) {
    const raw = (formData.get(field.key) as string | null)?.trim() ?? "";
    if (field.required && !raw) {
      return { error: `Informe o campo "${field.label}".` };
    }
    values[field.key] = raw;
  }

  let status: "CONECTADO" | "PENDENTE" | "ERRO" = "PENDENTE";
  let verifyMessage = "Credenciais salvas. Este provedor não possui verificação automática disponível.";

  if (provider.oauthOnly) {
    verifyMessage = "Credenciais salvas. Clique em \"Conectar com o provedor\" para concluir a autorização OAuth.";
  } else {
    const result = await verifyIntegration(provider.key, values);
    if (result) {
      status = result.ok ? "CONECTADO" : "ERRO";
      verifyMessage = result.message;
    }
  }

  const config = Object.fromEntries(provider.fields.filter((f) => !f.secret).map((f) => [f.key, values[f.key]]));

  const integration = await db.integration.upsert({
    where: { organizationId_provider: { organizationId: user.organizationId, provider: provider.key } },
    create: {
      organizationId: user.organizationId,
      provider: provider.key,
      category: provider.category,
      status,
      config,
      connectedAt: status === "CONECTADO" ? new Date() : null,
      connectedByUserId: user.id,
    },
    update: {
      status,
      config,
      connectedAt: status === "CONECTADO" ? new Date() : null,
      connectedByUserId: user.id,
    },
  });

  const secretFields = provider.fields.filter((f) => f.secret && values[f.key]);
  await db.integrationCredential.deleteMany({ where: { integrationId: integration.id } });
  if (secretFields.length > 0) {
    await db.integrationCredential.createMany({
      data: secretFields.map((f) => {
        const { encryptedValue, iv, authTag } = encryptSecret(values[f.key]);
        return {
          integrationId: integration.id,
          label: f.key,
          encryptedValue,
          iv,
          authTag,
          maskedPreview: maskSecret(values[f.key]),
        };
      }),
    });
  }

  await db.integrationLog.create({
    data: {
      organizationId: user.organizationId,
      integrationId: integration.id,
      direction: "SAIDA",
      eventType: "VERIFICACAO_CONEXAO",
      status: status === "CONECTADO" ? "SUCESSO" : status === "ERRO" ? "FALHA" : "PENDENTE",
      errorMessage: status === "ERRO" ? verifyMessage : null,
    },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INTEGRATION_CONNECTED",
    entityType: "Integration",
    entityId: integration.id,
    metadata: { provider: provider.key, status },
  });

  revalidatePath("/configuracoes/integracoes");

  if (status === "ERRO") return { error: verifyMessage };
  return { success: verifyMessage };
}

export async function disconnectIntegrationAction(integrationId: string): Promise<void> {
  const user = await requirePermission(permKey("INTEGRATIONS", "MANAGE"));

  const integration = await db.integration.findFirst({ where: { id: integrationId, organizationId: user.organizationId } });
  if (!integration) return;

  if (integration.provider === "WHATSAPP_BUSINESS") {
    await disconnectWhatsAppSession(user.organizationId);
  }

  await db.integrationCredential.deleteMany({ where: { integrationId } });
  await db.integration.update({
    where: { id: integrationId },
    data: { status: "DESCONECTADO", connectedAt: null, config: undefined },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INTEGRATION_DISCONNECTED",
    entityType: "Integration",
    entityId: integrationId,
    metadata: { provider: integration.provider },
  });

  revalidatePath("/configuracoes/integracoes");
}
