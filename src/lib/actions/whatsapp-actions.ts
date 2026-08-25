"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { startWhatsAppSession, getWhatsAppSessionStatus, type WhatsAppSessionStatus } from "@/lib/integrations/whatsapp-baileys";

export async function connectWhatsAppAction(): Promise<void> {
  const user = await requirePermission(permKey("INTEGRATIONS", "MANAGE"));
  await startWhatsAppSession(user.organizationId);
  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "WHATSAPP_CONNECTION_STARTED",
    entityType: "Integration",
  });
}

export async function getWhatsAppStatusAction(): Promise<WhatsAppSessionStatus> {
  const user = await requirePermission(permKey("INTEGRATIONS", "VIEW"));

  const current = getWhatsAppSessionStatus(user.organizationId);
  if (current.status === "disconnected") {
    // Sem sessão em memória (ex: logo após um restart) — se já tinha
    // conectado antes, tenta retomar sozinho com as credenciais em disco.
    const integration = await db.integration.findUnique({
      where: { organizationId_provider: { organizationId: user.organizationId, provider: "WHATSAPP_BUSINESS" } },
    });
    if (integration?.status === "CONECTADO") {
      await startWhatsAppSession(user.organizationId);
      return getWhatsAppSessionStatus(user.organizationId);
    }
  }
  return current;
}
