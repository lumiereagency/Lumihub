"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { messageTemplateSchema, renderMessageBody } from "@/lib/validation/billing";
import { sendReminderMessage } from "@/lib/integrations/messaging";
import { formatCurrency, formatDate } from "@/lib/format";
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

// Processa manualmente a fila de lembretes vencidos (scheduledFor <= agora).
// Em produção isso rodaria em um job agendado; sem infraestrutura de cron
// disponível aqui, o disparo manual mantém a arquitetura real e honesta em
// vez de simular um agendador que não existe.
export async function processReminderQueueAction(): Promise<ActionState> {
  const user = await requirePermission(permKey("RECEIVABLES", "MANAGE"));

  const organization = await db.organization.findUniqueOrThrow({ where: { id: user.organizationId } });

  const dueReminders = await db.paymentReminder.findMany({
    where: {
      status: "AGENDADO",
      scheduledFor: { lte: new Date() },
      receivable: { organizationId: user.organizationId },
    },
    include: { receivable: { include: { client: true } }, messageTemplate: true },
  });

  if (dueReminders.length === 0) {
    return { success: "Nenhum lembrete pendente para processar agora." };
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders) {
    const client = reminder.receivable.client;
    const bodyTemplate =
      reminder.messageTemplate?.body ?? "Olá, {{nome}}. Cobrança de {{valor}} com vencimento em {{vencimento}}. Pix: {{pix}}";
    const messageBody = renderMessageBody(bodyTemplate, {
      clientName: client.contactName ?? client.companyName,
      valueLabel: formatCurrency(Number(reminder.receivable.amount), organization.currency),
      dueDateLabel: formatDate(reminder.receivable.dueDate),
      pixKey: null,
    });

    const to = reminder.channel === "WHATSAPP" ? client.phone : client.email;
    const result = await sendReminderMessage(user.organizationId, reminder.channel, to, "Lembrete de cobrança — LUMIBASE", messageBody);

    await db.paymentReminder.update({
      where: { id: reminder.id },
      data: {
        status: result.delivered ? "ENVIADO" : "FALHOU",
        sentAt: new Date(),
        messageBody: result.delivered ? messageBody : `${messageBody}\n\n[Falha: ${result.error}]`,
      },
    });

    if (result.delivered) sent += 1;
    else failed += 1;
  }

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_QUEUE_PROCESSED",
    entityType: "PaymentReminder",
    metadata: { total: dueReminders.length, sent, failed },
  });

  revalidatePath("/financeiro/cobrancas");

  if (sent > 0 && failed === 0) return { success: `${sent} lembrete(s) processado(s) com sucesso.` };
  if (sent > 0 && failed > 0) return { success: `${sent} enviado(s), ${failed} falharam (canal não conectado).` };
  return { error: `${failed} lembrete(s) falharam: nenhum canal de comunicação está conectado ainda.` };
}
