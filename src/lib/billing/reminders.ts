import "server-only";
import { db } from "@/lib/db";
import { TRIGGER_OFFSET_DAYS } from "@/lib/validation/billing";
import { sendReminderMessage, isChannelConnected } from "@/lib/integrations/messaging";
import { buildChargeContext, renderCharge, type ChargeContext } from "@/lib/billing/charge";
import { notifyUsers } from "@/lib/notifications/notify";
import { addDays, brasiliaDay, dueDay, noonOf } from "@/lib/billing/dates";
import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

// LUMI COBRANÇAS — régua de lembretes ao cliente.
// Regras para nunca incomodar à toa:
//   • só envia de segunda a sábado, das 9h às 18h (Brasília);
//   • só envia o lembrete do dia — o que passou do dia sem sair é cancelado
//     (nada de despejar lembretes acumulados de uma vez);
//   • "vence em X dias" nunca sai depois do vencimento;
//   • cobrança paga ou cancelada não recebe mais nada;
//   • no máximo uma mensagem por cobrança por dia;
//   • intervalo entre envios no WhatsApp, para proteger o número.

const DAY = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 12;

function brasiliaClock(date: Date): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
  return { hour, weekday };
}

export function isSendingWindow(now = new Date()): boolean {
  const { hour, weekday } = brasiliaClock(now);
  return weekday !== 0 && hour >= 9 && hour < 18;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Agenda a régua de uma cobrança a partir dos modelos ativos (só os que
// ainda não tem e só para hoje em diante). Cada lembrete fica ao meio-dia
// de Brasília do seu dia.
export async function generateRemindersForReceivable(tx: TxClient, receivableId: string) {
  const receivable = await tx.accountReceivable.findUniqueOrThrow({ where: { id: receivableId } });
  if (receivable.status === "PAGO" || receivable.status === "CANCELADO") return;
  const existing = await tx.paymentReminder.findMany({ where: { receivableId }, select: { messageTemplateId: true } });
  const have = new Set(existing.map((e) => e.messageTemplateId));
  const templates = await tx.messageTemplate.findMany({ where: { organizationId: receivable.organizationId, active: true } });
  const today = brasiliaDay(new Date());
  const due = dueDay(receivable.dueDate);
  const data = templates
    .filter((t) => !have.has(t.id))
    .map((t) => {
      const offsetDays = TRIGGER_OFFSET_DAYS[t.trigger];
      const day = addDays(due, offsetDays);
      return { day, row: { receivableId, messageTemplateId: t.id, offsetDays, channel: t.channel, status: "AGENDADO" as const, scheduledFor: noonOf(day) } };
    })
    .filter((x) => x.day >= today)
    .map((x) => x.row);
  if (data.length) await tx.paymentReminder.createMany({ data });
}

// Mantém a régua em dia com os modelos atuais: cobranças em aberto ganham
// os lembretes de modelos criados depois delas; modelos desligados ou
// apagados deixam de enviar.
async function syncReminders(organizationId?: string) {
  const orgFilter = organizationId ? { organizationId } : {};
  await db.paymentReminder.updateMany({
    where: {
      status: "AGENDADO",
      receivable: orgFilter,
      OR: [{ messageTemplateId: null }, { messageTemplate: { active: false } }],
    },
    data: { status: "CANCELADO" },
  });
  const open = await db.accountReceivable.findMany({
    where: { ...orgFilter, status: { in: ["PENDENTE", "ATRASADO"] }, dueDate: { gte: new Date(Date.now() - 7 * DAY) } },
    select: { id: true },
  });
  for (const r of open) await db.$transaction((tx) => generateRemindersForReceivable(tx, r.id));
}

async function cancelInvalid(organizationId?: string) {
  const today = brasiliaDay(new Date());
  const pending = await db.paymentReminder.findMany({
    where: { status: "AGENDADO", receivable: organizationId ? { organizationId } : {} },
    select: { id: true, offsetDays: true, scheduledFor: true, receivable: { select: { status: true, dueDate: true } } },
  });
  const cancel: string[] = [];
  for (const r of pending) {
    const due = dueDay(r.receivable.dueDate);
    const day = addDays(due, r.offsetDays); // dia certo mesmo para lembretes antigos salvos em UTC
    if (r.receivable.status === "PAGO" || r.receivable.status === "CANCELADO") cancel.push(r.id);
    else if (r.offsetDays < 0 && due < today) cancel.push(r.id); // "vence em X dias" depois que venceu
    else if (day < today) cancel.push(r.id); // passou do dia sem sair: não acumula
    else if (r.scheduledFor.getTime() !== noonOf(day).getTime()) await db.paymentReminder.update({ where: { id: r.id }, data: { scheduledFor: noonOf(day) } });
  }
  if (cancel.length) await db.paymentReminder.updateMany({ where: { id: { in: cancel } }, data: { status: "CANCELADO" } });
}

// Envia a mensagem principal e, se configurado, o Pix copia e cola sozinho
// numa segunda mensagem (fica fácil de copiar no celular).
export async function deliverCharge(ctx: ChargeContext, channel: "WHATSAPP" | "EMAIL", body: string): Promise<{ delivered: boolean; error?: string }> {
  const to = channel === "WHATSAPP" ? ctx.phone : ctx.email;
  const result = await sendReminderMessage(ctx.organizationId, channel, to, `Fatura ${ctx.description} — ${ctx.company}`, body);
  if (result.delivered && channel === "WHATSAPP" && ctx.pixSeparate && ctx.pixCode && !body.includes(ctx.pixCode)) {
    await sleep(1500);
    await sendReminderMessage(ctx.organizationId, channel, to, "", ctx.pixCode);
  }
  return result;
}

async function notifyFailures(organizationId: string, failed: number, reason: string) {
  const users = await db.user.findMany({
    where: {
      organizationId,
      isActive: true,
      deletedAt: null,
      OR: [{ isOwner: true }, { role: { key: "ADMIN" } }, { role: { permissions: { some: { permission: { key: "RECEIVABLES_MANAGE" } } } } }],
    },
    select: { id: true },
  });
  await notifyUsers({
    organizationId,
    userIds: users.map((u) => u.id),
    title: failed === 1 ? "1 lembrete de cobrança não foi enviado" : `${failed} lembretes de cobrança não foram enviados`,
    body: reason,
    link: "/financeiro/cobrancas",
    category: "financeiro",
    dedupeKey: `billing-fail:${organizationId}:${brasiliaDay(new Date())}`,
  });
}

export async function processDuePaymentReminders(
  organizationId?: string,
  opts: { ignoreWindow?: boolean } = {},
): Promise<{ sent: number; failed: number; outsideWindow: boolean }> {
  await syncReminders(organizationId);
  await cancelInvalid(organizationId);
  if (!opts.ignoreWindow && !isSendingWindow()) return { sent: 0, failed: 0, outsideWindow: true };

  const today = brasiliaDay(new Date());
  const due = await db.paymentReminder.findMany({
    where: {
      status: "AGENDADO",
      scheduledFor: { lte: noonOf(today) },
      receivable: { ...(organizationId ? { organizationId } : {}), status: { in: ["PENDENTE", "ATRASADO"] } },
    },
    include: { messageTemplate: true, receivable: { select: { organizationId: true } } },
    orderBy: { offsetDays: "desc" },
  });

  // Uma mensagem por cobrança por dia: fica a do modelo mais "à frente".
  const chosen = new Map<string, (typeof due)[number]>();
  const skipped: string[] = [];
  for (const r of due) {
    if (chosen.has(r.receivableId)) skipped.push(r.id);
    else chosen.set(r.receivableId, r);
  }
  if (skipped.length) await db.paymentReminder.updateMany({ where: { id: { in: skipped } }, data: { status: "CANCELADO" } });

  let sent = 0;
  let failed = 0;
  const failures = new Map<string, { count: number; reason: string }>();
  let first = true;
  for (const reminder of [...chosen.values()].slice(0, MAX_PER_RUN)) {
    if (!reminder.messageTemplate) continue;
    // Nenhuma cobrança paga recebe lembrete, mesmo que tenha sido paga durante o processamento.
    const fresh = await db.accountReceivable.findUnique({ where: { id: reminder.receivableId }, select: { status: true } });
    if (!fresh || fresh.status === "PAGO" || fresh.status === "CANCELADO") {
      await db.paymentReminder.update({ where: { id: reminder.id }, data: { status: "CANCELADO" } });
      continue;
    }
    if (!first && reminder.channel === "WHATSAPP") await sleep(6000 + Math.floor(Math.random() * 6000));
    first = false;

    const ctx = await buildChargeContext(reminder.receivableId);
    const body = renderCharge(reminder.messageTemplate.body, ctx);
    const result = await deliverCharge(ctx, reminder.channel, body);
    await db.paymentReminder.update({
      where: { id: reminder.id },
      data: { status: result.delivered ? "ENVIADO" : "FALHOU", sentAt: new Date(), messageBody: result.delivered ? body : `${body}\n\n[Falha: ${result.error}]` },
    });
    if (result.delivered) sent++;
    else {
      failed++;
      const org = reminder.receivable.organizationId;
      const f = failures.get(org) ?? { count: 0, reason: result.error ?? "Falha no envio." };
      f.count++;
      failures.set(org, f);
    }
  }

  for (const [org, f] of failures) {
    const whatsappOk = await isChannelConnected(org, "WHATSAPP");
    await notifyFailures(org, f.count, whatsappOk ? f.reason : "O WhatsApp da empresa está desconectado. Reconecte em Configurações → Integrações para a régua voltar a enviar.");
  }

  return { sent, failed, outsideWindow: false };
}

// Agradecimento automático quando o financeiro confirma o pagamento.
export async function sendPaymentThanks(receivableId: string): Promise<void> {
  try {
    const r = await db.accountReceivable.findUnique({ where: { id: receivableId }, select: { status: true, thanksSentAt: true, organizationId: true } });
    if (!r || r.status !== "PAGO" || r.thanksSentAt) return;
    const ctx = await buildChargeContext(receivableId);
    const settings = await db.pricingSettings.findUnique({ where: { organizationId: r.organizationId }, select: { billingThanks: true } });
    if (settings && !settings.billingThanks) return;
    if (!ctx.phone || !(await isChannelConnected(r.organizationId, "WHATSAPP"))) return;
    const body = renderCharge("Oi, {{nome}}! Recebemos o pagamento de {{valor}} referente a {{descricao}}. Muito obrigado! 💛\n{{empresa}}", ctx);
    const result = await sendReminderMessage(r.organizationId, "WHATSAPP", ctx.phone, "", body);
    if (result.delivered) await db.accountReceivable.update({ where: { id: receivableId }, data: { thanksSentAt: new Date() } });
  } catch (e) {
    console.error("[cobranca] agradecimento não enviado", (e as Error).message);
  }
}
