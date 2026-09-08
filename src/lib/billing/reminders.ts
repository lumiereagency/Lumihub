import "server-only";
import { db } from "@/lib/db";
import { TRIGGER_OFFSET_DAYS, renderMessageBody } from "@/lib/validation/billing";
import { sendReminderMessage } from "@/lib/integrations/messaging";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

// LUMI COBRANÇAS (Fase 9): gera a régua de lembretes de uma cobrança a
// partir dos modelos de mensagem ativos da organização. Idempotente — não
// duplica lembretes já existentes para a mesma cobrança.
export async function generateRemindersForReceivable(tx: TxClient, receivableId: string) {
  const receivable = await tx.accountReceivable.findUniqueOrThrow({ where: { id: receivableId } });

  const existing = await tx.paymentReminder.findFirst({ where: { receivableId } });
  if (existing) return;

  const templates = await tx.messageTemplate.findMany({
    where: { organizationId: receivable.organizationId, active: true },
  });
  if (templates.length === 0) return;

  await tx.paymentReminder.createMany({
    data: templates.map((t) => {
      const offsetDays = TRIGGER_OFFSET_DAYS[t.trigger];
      const scheduledFor = new Date(receivable.dueDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
      return {
        receivableId,
        messageTemplateId: t.id,
        offsetDays,
        channel: t.channel,
        status: "AGENDADO" as const,
        scheduledFor,
      };
    }),
  });
}

// Dispara os lembretes vencidos (scheduledFor <= agora) por WhatsApp/e-mail
// (§ pedido do usuário: "Lumi Cobranças" hoje só processa a régua quando
// alguém lembra de clicar em 'Processar régua agora' — o próprio time
// documentou isso como decisão temporária, "sem infraestrutura de cron
// disponível ainda", mas essa infraestrutura já existe desde a rodada
// diária de /api/cron/generate-receivables). Sem organizationId processa
// TODAS as organizações (uso do cron diário); com organizationId, só a
// dela (uso do botão manual em Cobranças, que continua existindo).
export async function processDuePaymentReminders(organizationId?: string): Promise<{ sent: number; failed: number }> {
  const dueReminders = await db.paymentReminder.findMany({
    where: {
      status: "AGENDADO",
      scheduledFor: { lte: new Date() },
      receivable: organizationId ? { organizationId } : undefined,
    },
    include: {
      receivable: { include: { client: true, organization: { select: { currency: true } } } },
      messageTemplate: true,
    },
  });

  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders) {
    const client = reminder.receivable.client;
    const bodyTemplate =
      reminder.messageTemplate?.body ?? "Olá, {{nome}}. Cobrança de {{valor}} com vencimento em {{vencimento}}. Pix: {{pix}}";
    const messageBody = renderMessageBody(bodyTemplate, {
      clientName: client.contactName ?? client.companyName,
      valueLabel: formatCurrency(Number(reminder.receivable.amount), reminder.receivable.organization.currency),
      dueDateLabel: formatDate(reminder.receivable.dueDate),
      pixKey: null,
    });

    const to = reminder.channel === "WHATSAPP" ? client.phone : client.email;
    const result = await sendReminderMessage(reminder.receivable.organizationId, reminder.channel, to, "Lembrete de cobrança — LUMIBASE", messageBody);

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

  return { sent, failed };
}
