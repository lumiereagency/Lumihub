"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { messageTemplateSchema } from "@/lib/validation/billing";
import { processDuePaymentReminders } from "@/lib/billing/reminders";
import type { ActionState } from "@/lib/actions/auth-actions";

function parseTemplateForm(formData: FormData) {
  return messageTemplateSchema.safeParse({
    name: formData.get("name"),
    trigger: formData.get("trigger") || "D_0",
    channel: formData.get("channel") || "WHATSAPP",
    body: formData.get("body"),
    active: formData.get("active") === "on",
  });
}

export async function createMessageTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("RECEIVABLES", "MANAGE"));

  const parsed = parseTemplateForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const template = await db.messageTemplate.create({ data: { organizationId: user.organizationId, ...parsed.data } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MESSAGE_TEMPLATE_CREATED",
    entityType: "MessageTemplate",
    entityId: template.id,
  });

  revalidatePath("/financeiro/cobrancas");
  return { success: "Modelo de mensagem criado." };
}

export async function toggleMessageTemplateAction(templateId: string, active: boolean) {
  const user = await requirePermission(permKey("RECEIVABLES", "MANAGE"));

  const template = await db.messageTemplate.findFirst({ where: { id: templateId, organizationId: user.organizationId } });
  if (!template) return;

  await db.messageTemplate.update({ where: { id: templateId }, data: { active } });
  revalidatePath("/financeiro/cobrancas");
}

export async function deleteMessageTemplateAction(templateId: string) {
  const user = await requirePermission(permKey("RECEIVABLES", "MANAGE"));

  const template = await db.messageTemplate.findFirst({ where: { id: templateId, organizationId: user.organizationId } });
  if (!template) return;

  await db.messageTemplate.delete({ where: { id: templateId } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MESSAGE_TEMPLATE_DELETED",
    entityType: "MessageTemplate",
    entityId: templateId,
  });

  revalidatePath("/financeiro/cobrancas");
}

// Botão "Processar régua agora" (§ pedido do usuário: continua existindo
// como atalho manual/teste) — a régua em si já roda sozinha todo dia via
// /api/cron/process-reminders, mesma infraestrutura de crontab já usada
// por generate-receivables e escalate-swap-requests.
export async function processReminderQueueAction(): Promise<ActionState> {
  const user = await requirePermission(permKey("RECEIVABLES", "MANAGE"));

  const { sent, failed } = await processDuePaymentReminders(user.organizationId);

  if (sent === 0 && failed === 0) {
    return { success: "Nenhum lembrete pendente para processar agora." };
  }

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_QUEUE_PROCESSED",
    entityType: "PaymentReminder",
    metadata: { total: sent + failed, sent, failed },
  });

  revalidatePath("/financeiro/cobrancas");

  if (sent > 0 && failed === 0) return { success: `${sent} lembrete(s) processado(s) com sucesso.` };
  if (sent > 0 && failed > 0) return { success: `${sent} enviado(s), ${failed} falharam (canal não conectado).` };
  return { error: `${failed} lembrete(s) falharam: nenhum canal de comunicação está conectado ainda.` };
}
