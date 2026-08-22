import "server-only";
import { TRIGGER_OFFSET_DAYS } from "@/lib/validation/billing";
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
