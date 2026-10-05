"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { DEFAULT_MESSAGE_TEMPLATES, messageTemplateSchema } from "@/lib/validation/billing";
import { deliverCharge, processDuePaymentReminders } from "@/lib/billing/reminders";
import { buildChargeContext, defaultChargeMessage, ensurePublicToken, appUrl, renderCharge } from "@/lib/billing/charge";
import { addDays, brasiliaDay, dueDay } from "@/lib/billing/dates";
import { isChannelConnected } from "@/lib/integrations/messaging";
import { getPricingSettings } from "@/lib/pricing/settings";
import { TRIGGER_OFFSET_DAYS } from "@/lib/validation/billing";
import type { ActionState } from "@/lib/actions/auth-actions";
import { writeChargeWithAi, writeTemplateWithAi } from "@/lib/ai/billing-writer";
import { buildGroupContext, groupMessage, openChargesFor } from "@/lib/billing/group";

async function orgCurrency(organizationId: string): Promise<string> {
  const o = await db.organization.findUnique({ where: { id: organizationId }, select: { currency: true } });
  return o?.currency ?? "BRL";
}

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

  // Botão manual: quem clicou decidiu enviar agora, então ignora o horário comercial
  // (mas continua mandando só os lembretes do dia, nunca o acúmulo).
  const { sent, failed } = await processDuePaymentReminders(user.organizationId, { ignoreWindow: true });

  if (sent === 0 && failed === 0) {
    return { success: "Nenhum lembrete para hoje." };
  }

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "REMINDER_QUEUE_PROCESSED",
    entityType: "PaymentReminder",
    metadata: { total: sent + failed, sent, failed },
  });

  revalidatePath("/financeiro/cobrancas");

  if (sent > 0 && failed === 0) return { success: `${sent} lembrete(s) enviado(s).` };
  if (sent > 0 && failed > 0) return { success: `${sent} enviado(s), ${failed} com falha. Veja o motivo na lista abaixo.` };
  return { error: `${failed} lembrete(s) não foram enviados. Veja o motivo na lista abaixo.` };
}

export async function updateMessageTemplateAction(templateId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("RECEIVABLES", "MANAGE"));
  const parsed = parseTemplateForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  const template = await db.messageTemplate.findFirst({ where: { id: templateId, organizationId: user.organizationId } });
  if (!template) return { error: "Modelo não encontrado." };
  await db.messageTemplate.update({ where: { id: templateId }, data: parsed.data });
  // Quando muda o "quando enviar", os lembretes agendados desse modelo são refeitos pela régua.
  if (template.trigger !== parsed.data.trigger || template.channel !== parsed.data.channel) {
    await db.paymentReminder.deleteMany({ where: { messageTemplateId: templateId, status: "AGENDADO" } });
  }
  revalidatePath("/financeiro/cobrancas");
  return { success: "Modelo atualizado." };
}

export async function createDefaultTemplatesAction(): Promise<ActionState> {
  const user = await requirePermission(permKey("RECEIVABLES", "MANAGE"));
  const existing = await db.messageTemplate.findMany({ where: { organizationId: user.organizationId }, select: { trigger: true } });
  const have = new Set(existing.map((t) => t.trigger));
  const missing = DEFAULT_MESSAGE_TEMPLATES.filter((t) => !have.has(t.trigger));
  if (missing.length === 0) return { success: "Os modelos prontos já estão na sua régua." };
  await db.messageTemplate.createMany({
    data: missing.map((t) => ({ organizationId: user.organizationId, name: t.name, trigger: t.trigger, channel: "WHATSAPP" as const, body: t.body, active: true })),
  });
  // Já agenda para as cobranças em aberto.
  await processDuePaymentReminders(user.organizationId, { ignoreWindow: false }).catch(() => {});
  revalidatePath("/financeiro/cobrancas");
  return { success: `${missing.length} modelo(s) pronto(s) adicionado(s).` };
}

export async function updateBillingSettingsAction(input: { thanks: boolean; pixSeparate: boolean }): Promise<{ ok: boolean }> {
  const user = await requirePermission(permKey("RECEIVABLES", "MANAGE"));
  const data = { billingThanks: !!input.thanks, billingPixSeparate: !!input.pixSeparate };
  const current = await getPricingSettings(user.organizationId);
  await db.pricingSettings.upsert({
    where: { organizationId: user.organizationId },
    create: {
      organizationId: user.organizationId,
      installmentFees: current.config.rows as object,
      debitFee: current.config.debitFee,
      creditMargin: current.config.creditMargin,
      maxInstallments: current.config.maxInstallments,
      ...data,
    },
    update: data,
  });
  revalidatePath("/financeiro/cobrancas");
  return { ok: true };
}

async function loadReceivable(receivableId: string, organizationId: string) {
  return db.accountReceivable.findFirst({ where: { id: receivableId, organizationId } });
}

export async function getPaymentLinkAction(receivableId: string): Promise<{ ok: boolean; link?: string }> {
  const user = await requirePermission(permKey("RECEIVABLES", "VIEW"));
  if (!(await loadReceivable(receivableId, user.organizationId))) return { ok: false };
  const token = await ensurePublicToken(receivableId);
  return { ok: true, link: `${appUrl()}/pagar/${token}` };
}

export interface ChargePreview {
  ok: boolean;
  error?: string;
  body?: string;
  pixCode?: string | null;
  pixSeparate?: boolean;
  link?: string;
  phone?: string | null;
  whatsappConnected?: boolean;
  hasPixKey?: boolean;
}

// Mensagem sugerida para "Enviar cobrança agora": usa o modelo da régua mais
// próximo da situação (antes, no dia ou depois do vencimento).
export async function previewChargeAction(receivableId: string): Promise<ChargePreview> {
  const user = await requirePermission(permKey("RECEIVABLES", "EDIT"));
  const r = await loadReceivable(receivableId, user.organizationId);
  if (!r) return { ok: false, error: "Cobrança não encontrada." };
  if (r.status === "PAGO" || r.status === "CANCELADO") return { ok: false, error: "Esta cobrança já está paga ou cancelada." };
  const today = brasiliaDay(new Date());
  const due = dueDay(r.dueDate);
  let diff = 0;
  while (addDays(due, diff) < today && diff < 400) diff++;
  while (addDays(due, diff) > today && diff > -400) diff--;
  const templates = await db.messageTemplate.findMany({ where: { organizationId: user.organizationId, active: true, channel: "WHATSAPP" } });
  const candidates = templates
    .map((t) => ({ t, off: TRIGGER_OFFSET_DAYS[t.trigger] }))
    .filter(({ off }) => (diff < 0 ? off < 0 : diff === 0 ? off === 0 : off > 0))
    .sort((a, b) => Math.abs(a.off - diff) - Math.abs(b.off - diff));
  // Cliente com mais de uma fatura em aberto: mesma mensagem única da régua.
  const { items } = await openChargesFor(receivableId);
  const grouped = items.length > 1;
  const ctx = grouped ? await buildGroupContext(receivableId, items) : await buildChargeContext(receivableId);
  const body = grouped ? groupMessage(ctx, items, await orgCurrency(user.organizationId)) : renderCharge(candidates[0]?.t.body ?? defaultChargeMessage(diff), ctx);
  return {
    ok: true,
    body,
    pixCode: ctx.pixCode,
    pixSeparate: ctx.pixSeparate,
    link: ctx.link,
    phone: ctx.phone,
    whatsappConnected: await isChannelConnected(user.organizationId, "WHATSAPP"),
    hasPixKey: !!ctx.pixKey,
  };
}

export async function sendChargeNowAction(receivableId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePermission(permKey("RECEIVABLES", "EDIT"));
  const r = await loadReceivable(receivableId, user.organizationId);
  if (!r) return { ok: false, error: "Cobrança não encontrada." };
  if (r.status === "PAGO" || r.status === "CANCELADO") return { ok: false, error: "Esta cobrança já está paga ou cancelada." };
  const text = String(body ?? "").trim().slice(0, 3000);
  if (text.length < 5) return { ok: false, error: "Escreva a mensagem." };
  const { items } = await openChargesFor(receivableId);
  const ctx = items.length > 1 ? await buildGroupContext(receivableId, items) : await buildChargeContext(receivableId);
  const result = await deliverCharge(ctx, "WHATSAPP", text);
  await db.paymentReminder.create({
    data: {
      receivableId,
      offsetDays: 0,
      channel: "WHATSAPP",
      status: result.delivered ? "ENVIADO" : "FALHOU",
      scheduledFor: new Date(),
      sentAt: new Date(),
      messageBody: result.delivered ? text : `${text}\n\n[Falha: ${result.error}]`,
    },
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "CHARGE_SENT_MANUALLY", entityType: "AccountReceivable", entityId: receivableId, metadata: { delivered: result.delivered } });
  revalidatePath("/financeiro/cobrancas");
  revalidatePath("/financeiro/receber");
  return result.delivered ? { ok: true } : { ok: false, error: result.error ?? "Não foi possível enviar." };
}

// Ações da equipe sobre os lembretes: "já cobrei por fora" (feito à mão),
// cancelar, reativar um cancelado e parar a régua de uma fatura inteira.
const REMINDER_ACTIONS = ["manual", "cancel", "reactivate", "stop"] as const;
type ReminderAction = (typeof REMINDER_ACTIONS)[number];

export async function updateRemindersAction(ids: string[], action: ReminderAction): Promise<{ ok: boolean; changed?: number; error?: string }> {
  const user = await requirePermission(permKey("RECEIVABLES", "EDIT"));
  if (!REMINDER_ACTIONS.includes(action) || !Array.isArray(ids) || ids.length === 0 || ids.length > 200) return { ok: false, error: "Nada selecionado." };
  const reminders = await db.paymentReminder.findMany({
    where: { id: { in: ids.filter((i) => typeof i === "string") }, receivable: { organizationId: user.organizationId } },
    select: { id: true, status: true, offsetDays: true, receivableId: true, receivable: { select: { status: true, dueDate: true } } },
  });
  if (reminders.length === 0) return { ok: false, error: "Lembrete não encontrado." };

  const stamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const who = user.name.split(" ")[0];
  const open = (s: string) => s === "AGENDADO" || s === "FALHOU";
  let changed = 0;

  if (action === "manual") {
    const target = reminders.filter((r) => open(r.status)).map((r) => r.id);
    if (target.length) {
      const res = await db.paymentReminder.updateMany({
        where: { id: { in: target } },
        data: { status: "MANUAL", sentAt: new Date(), messageBody: `Cobrado por fora — marcado por ${who} em ${stamp}.` },
      });
      changed = res.count;
    }
  } else if (action === "cancel") {
    const target = reminders.filter((r) => open(r.status)).map((r) => r.id);
    if (target.length) {
      const res = await db.paymentReminder.updateMany({ where: { id: { in: target } }, data: { status: "CANCELADO", messageBody: `Cancelado por ${who} em ${stamp}.` } });
      changed = res.count;
    }
  } else if (action === "stop") {
    const receivableIds = [...new Set(reminders.map((r) => r.receivableId))];
    const res = await db.paymentReminder.updateMany({
      where: { receivableId: { in: receivableIds }, status: "AGENDADO" },
      data: { status: "CANCELADO", messageBody: `Régua parada por ${who} em ${stamp}.` },
    });
    changed = res.count;
  } else {
    // Só volta a agendar o que ainda tem dia pela frente e cuja fatura segue em aberto.
    const today = brasiliaDay(new Date());
    const target = reminders.filter(
      (r) =>
        r.status === "CANCELADO" &&
        (r.receivable.status === "PENDENTE" || r.receivable.status === "ATRASADO") &&
        addDays(dueDay(r.receivable.dueDate), r.offsetDays) >= today &&
        !(r.offsetDays < 0 && dueDay(r.receivable.dueDate) < today),
    );
    if (target.length) {
      const res = await db.paymentReminder.updateMany({ where: { id: { in: target.map((r) => r.id) } }, data: { status: "AGENDADO", messageBody: null } });
      changed = res.count;
    }
    if (changed === 0) return { ok: false, error: "Só dá para reativar lembretes de hoje em diante, de faturas ainda em aberto." };
  }

  await audit({ organizationId: user.organizationId, userId: user.id, action: "REMINDERS_UPDATED", entityType: "PaymentReminder", metadata: { action, ids, changed } });
  revalidatePath("/financeiro/cobrancas");
  return { ok: true, changed };
}

// ---------- IA: mensagens de cobrança ----------

export async function aiTemplateAction(input: { trigger: string; tone: string; instructions?: string; current?: string }): Promise<{ ok: boolean; body?: string; error?: string }> {
  const user = await requirePermission(permKey("RECEIVABLES", "MANAGE"));
  try {
    const body = await writeTemplateWithAi(user.organizationId, {
      trigger: String(input.trigger ?? "D_0"),
      tone: String(input.tone ?? "amigavel"),
      instructions: String(input.instructions ?? "").slice(0, 500),
      current: String(input.current ?? "").slice(0, 2000),
    });
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function aiChargeMessageAction(receivableId: string, input: { tone: string; instructions?: string; current?: string }): Promise<{ ok: boolean; body?: string; error?: string }> {
  const user = await requirePermission(permKey("RECEIVABLES", "EDIT"));
  const r = await loadReceivable(receivableId, user.organizationId);
  if (!r) return { ok: false, error: "Cobrança não encontrada." };
  if (r.status === "PAGO" || r.status === "CANCELADO") return { ok: false, error: "Esta cobrança já está paga ou cancelada." };
  try {
    const body = await writeChargeWithAi(user.organizationId, receivableId, {
      tone: String(input.tone ?? "amigavel"),
      instructions: String(input.instructions ?? "").slice(0, 500),
      current: String(input.current ?? "").slice(0, 3000),
    });
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
