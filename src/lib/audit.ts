import "server-only";
import { db } from "@/lib/db";
import { getRequestMeta } from "@/lib/auth/session";

interface AuditInput {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

// Registra uma ação relevante para trilha de auditoria (Fase 1.6).
// Nunca deve conter secrets — os providers de integração são responsáveis
// por redigir valores sensíveis antes de chamar esta função.
export async function audit(input: AuditInput) {
  const { ip, userAgent } = await getRequestMeta();
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata as never,
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    },
  });
}
