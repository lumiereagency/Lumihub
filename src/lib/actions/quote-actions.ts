"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isDirector, requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { computeQuote } from "@/lib/pricing/engine";
import { fillTemplate, getPricingSettings } from "@/lib/pricing/settings";
import { findLeadDuplicate } from "@/lib/crm/duplicates";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { LEAD_STAGES } from "@/lib/validation/crm";
import { formatDate } from "@/lib/format";

type Fail = { ok: false; error: string };

const money = z.number().nonnegative().max(100_000_000);

const itemSchema = z.object({
  serviceId: z.string().nullable().optional(),
  name: z.string().trim().min(1, "Todo item precisa de um nome.").max(160),
  tagline: z.string().trim().max(200).nullable().optional(),
  features: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  billing: z.enum(["MENSAL", "PONTUAL"]),
  quantity: z.number().int().min(1).max(999),
  unitPrice: money,
  monthlyFee: money.nullable().optional(),
  priceIsFrom: z.boolean().default(false),
  cardMode: z.enum(["AUTO", "FIXED", "NONE"]),
  cardPrice: money.nullable().optional(),
  maxInstallments: z.number().int().min(1).max(18).nullable().optional(),
  minMonths: z.number().int().min(1).max(60).nullable().optional(),
  terms: z.string().trim().max(1000).nullable().optional(),
});

const quoteSchema = z.object({
  title: z.string().trim().min(1, "Dê um título ao orçamento.").max(160),
  leadId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  recipientName: z.string().trim().max(120).optional(),
  recipientPhone: z.string().trim().max(40).optional(),
  intro: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(4000).optional(),
  validUntil: z.string().nullable().optional(),
  currency: z.enum(["BRL", "USD"]).default("BRL"),
  discountPercent: z.number().min(0).max(100).default(0),
  maxInstallments: z.number().int().min(1).max(18).nullable().optional(),
  items: z.array(itemSchema).min(1, "Adicione pelo menos um serviço.").max(40),
});

export type QuoteInput = z.input<typeof quoteSchema>;

function newToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function revalidateQuotes(id?: string) {
  revalidatePath("/propostas");
  if (id) revalidatePath(`/propostas/${id}`);
  revalidatePath("/crm");
}

export async function saveQuoteAction(proposalId: string | null, input: QuoteInput): Promise<{ ok: true; id: string } | Fail> {
  const user = await requirePermission(permKey("CRM", proposalId ? "EDIT" : "CREATE"));
  const canManage = isDirector(user);
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os dados do orçamento." };
  const d = parsed.data;
  const org = user.organizationId;

  if (!d.leadId && !d.clientId) return { ok: false, error: "Escolha para qual lead ou cliente é o orçamento." };
  const [lead, client] = await Promise.all([
    d.leadId ? db.lead.findFirst({ where: { id: d.leadId, organizationId: org, deletedAt: null } }) : null,
    d.clientId ? db.client.findFirst({ where: { id: d.clientId, organizationId: org, deletedAt: null } }) : null,
  ]);
  if (d.leadId && !lead) return { ok: false, error: "Lead não encontrado." };
  if (d.clientId && !client) return { ok: false, error: "Cliente não encontrado." };

  const existing = proposalId ? await db.proposal.findFirst({ where: { id: proposalId, organizationId: org } }) : null;
  if (proposalId && !existing) return { ok: false, error: "Orçamento não encontrado." };
  if (existing?.status === "ACEITA") return { ok: false, error: "Este orçamento já foi aceito pelo cliente. Duplique-o para fazer uma nova versão." };

  // Preço de tabela é o preço: só quem gerencia o CRM muda valores, cria item
  // fora do catálogo ou dá desconto. "A partir de" aceita valor acima do mínimo.
  const serviceIds = d.items.map((i) => i.serviceId).filter((id): id is string => !!id);
  const services = new Map(
    (await db.service.findMany({ where: { organizationId: org, id: { in: serviceIds } } })).map((s) => [s.id, s]),
  );
  const items = [];
  for (const [position, item] of d.items.entries()) {
    const service = item.serviceId ? services.get(item.serviceId) : undefined;
    if (item.serviceId && !service) return { ok: false, error: `O serviço "${item.name}" não existe mais no catálogo.` };
    if (!service && !canManage) return { ok: false, error: "Só a diretoria pode incluir itens fora do catálogo." };
    const unitPrice = item.unitPrice;
    if (service && !canManage) {
      const table = Number(service.defaultPrice ?? 0);
      if (service.priceIsFrom ? unitPrice < table : unitPrice !== table) {
        return { ok: false, error: `"${service.name}" precisa seguir o preço de tabela${service.priceIsFrom ? ` (a partir de ${table})` : ""}. Condição diferente só com a diretoria.` };
      }
    }
    if (service && !canManage) {
      items.push({
        serviceId: service.id,
        name: item.name,
        tagline: item.tagline || null,
        features: item.features,
        billing: service.billing,
        quantity: item.quantity,
        unitPrice,
        monthlyFee: service.monthlyFee,
        priceIsFrom: false,
        cardMode: service.cardMode,
        cardPrice: service.cardPrice,
        maxInstallments: service.maxInstallments,
        minMonths: service.minMonths,
        terms: item.terms || null,
        position,
      });
    } else {
      items.push({
        serviceId: service?.id ?? null,
        name: item.name,
        tagline: item.tagline || null,
        features: item.features,
        billing: item.billing,
        quantity: item.quantity,
        unitPrice,
        monthlyFee: item.monthlyFee ?? null,
        priceIsFrom: false,
        cardMode: item.cardMode,
        cardPrice: item.cardMode === "FIXED" ? (item.cardPrice ?? null) : null,
        maxInstallments: item.maxInstallments ?? null,
        minMonths: item.minMonths ?? null,
        terms: item.terms || null,
        position,
      });
    }
  }
  if ([...services.values()].some((s) => s.currency !== d.currency)) {
    return { ok: false, error: "Não dá para misturar serviços em real e em dólar no mesmo orçamento." };
  }

  const discountPercent = canManage ? d.discountPercent : Number(existing?.discountPercent ?? 0);
  const settings = await getPricingSettings(org);
  const quote = computeQuote(
    items.map((i) => ({
      billing: i.billing,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      monthlyFee: i.monthlyFee == null ? null : Number(i.monthlyFee),
      cardMode: i.cardMode,
      cardPrice: i.cardPrice == null ? null : Number(i.cardPrice),
      maxInstallments: i.maxInstallments,
      minMonths: i.minMonths,
    })),
    settings.config,
    { discountPercent, maxInstallments: d.maxInstallments, currency: d.currency },
  );

  const validUntil = d.validUntil ? new Date(`${d.validUntil}T23:59:59-03:00`) : new Date(Date.now() + settings.validityDays * 86400000);
  const data = {
    title: d.title,
    leadId: lead?.id ?? null,
    clientId: client?.id ?? lead?.convertedClientId ?? null,
    recipientName: d.recipientName || client?.contactName || lead?.contactName || client?.companyName || lead?.company || null,
    recipientPhone: d.recipientPhone || lead?.whatsapp || lead?.phone || client?.phone || null,
    intro: d.intro || null,
    notes: d.notes || null,
    validUntil,
    currency: d.currency,
    discountPercent,
    maxInstallments: d.maxInstallments ?? null,
    value: quote.contractValue,
    oneTimeTotal: quote.oneTime?.pix ?? null,
    monthlyTotal: quote.monthly?.pix ?? null,
    minMonths: quote.minMonths,
    pricingSnapshot: settings.config as unknown as object,
  };

  let id: string;
  if (existing) {
    await db.$transaction([
      db.proposalItem.deleteMany({ where: { proposalId: existing.id } }),
      db.proposal.update({
        where: { id: existing.id },
        data: {
          ...data,
          publicToken: existing.publicToken ?? newToken(),
          items: { create: items },
          // Reabrir para nova resposta quando o cliente pediu ajuste.
          ...(existing.response === "AJUSTE" ? { response: null, respondedAt: null } : {}),
        },
      }),
    ]);
    id = existing.id;
  } else {
    const created = await db.proposal.create({
      data: { organizationId: org, createdByUserId: user.id, publicToken: newToken(), ...data, items: { create: items } },
    });
    id = created.id;
  }

  await audit({
    organizationId: org,
    userId: user.id,
    action: existing ? "PROPOSAL_UPDATED" : "PROPOSAL_CREATED",
    entityType: "Proposal",
    entityId: id,
    metadata: { value: quote.contractValue, items: items.length },
  });
  revalidateQuotes(id);
  return { ok: true, id };
}

// Lead novo direto do montador (mesma trava de duplicidade do CRM).
export async function quickLeadForQuoteAction(input: { company: string; contactName?: string; whatsapp?: string }): Promise<{ ok: true; id: string; company: string } | Fail> {
  const user = await requirePermission(permKey("CRM", "CREATE"));
  const company = input.company.trim();
  if (!company) return { ok: false, error: "Informe o nome do lead." };
  const dup = await findLeadDuplicate(user.organizationId, { company });
  if (dup) return { ok: false, error: `${dup} — selecione o lead existente na busca.` };
  const lead = await db.lead.create({
    data: {
      organizationId: user.organizationId,
      company,
      contactName: input.contactName?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      source: "Orçamento",
      stage: "QUALIFICADO",
      ownerUserId: user.id,
      createdByUserId: user.id,
    },
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "LEAD_CREATED", entityType: "Lead", entityId: lead.id, metadata: { company, source: "quote" } });
  revalidatePath("/crm");
  return { ok: true, id: lead.id, company: lead.company };
}

async function advanceLead(leadId: string | null, target: "PROPOSTA" | "NEGOCIACAO") {
  if (!leadId) return;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  if (LEAD_STAGES.indexOf(lead.stage) >= LEAD_STAGES.indexOf(target)) return;
  await db.lead.update({ where: { id: leadId }, data: { stage: target, lastContactAt: new Date() } });
}

async function markSent(proposalId: string, organizationId: string, userId: string, channel: string) {
  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId } });
  if (!proposal) return null;
  if (proposal.status === "RASCUNHO" || proposal.status === "EXPIRADA") {
    await db.proposal.update({ where: { id: proposalId }, data: { status: "ENVIADA", sentAt: proposal.sentAt ?? new Date() } });
  }
  await advanceLead(proposal.leadId, "PROPOSTA");
  await audit({ organizationId, userId, action: "PROPOSAL_SENT", entityType: "Proposal", entityId: proposalId, metadata: { channel } });
  return proposal;
}

export async function buildQuoteMessageAction(proposalId: string): Promise<{ ok: true; message: string; phone: string | null; link: string } | Fail> {
  const user = await requirePermission(permKey("CRM", "VIEW"));
  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId } });
  if (!proposal?.publicToken) return { ok: false, error: "Orçamento não encontrado." };
  const settings = await getPricingSettings(user.organizationId);
  const link = `${appUrl()}/orcamento/${proposal.publicToken}`;
  const message = fillTemplate(settings.whatsappTemplate, {
    nome: (proposal.recipientName ?? "").split(" ")[0] || "tudo bem",
    vendedor: user.name.split(" ")[0],
    titulo: proposal.title,
    link,
    validade: proposal.validUntil ? formatDate(proposal.validUntil) : "",
  });
  return { ok: true, message, phone: proposal.recipientPhone, link };
}

export async function sendQuoteWhatsAppAction(proposalId: string, phone: string, message: string): Promise<{ ok: true; delivered: boolean; to?: string } | Fail> {
  const user = await requirePermission(permKey("CRM", "EDIT"));
  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId } });
  if (!proposal) return { ok: false, error: "Orçamento não encontrado." };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return { ok: false, error: "Informe o WhatsApp do cliente com DDD." };
  if (!message.trim()) return { ok: false, error: "A mensagem está vazia." };

  const result = await sendWhatsApp({ organizationId: user.organizationId, to: digits, message: message.trim() });
  if (result.pending) return { ok: false, error: "O WhatsApp da Lumière não está conectado agora. Use \"Abrir no WhatsApp\" ou reconecte em Configurações → Integrações." };
  if (!result.delivered) return { ok: false, error: result.error ?? "Não foi possível enviar pelo WhatsApp." };

  if (proposal.recipientPhone !== phone) await db.proposal.update({ where: { id: proposalId }, data: { recipientPhone: phone } });
  await markSent(proposalId, user.organizationId, user.id, "whatsapp");
  revalidateQuotes(proposalId);
  return { ok: true, delivered: true, to: result.to };
}

// Copiou o link ou abriu o wa.me manualmente: conta como enviado.
export async function markQuoteSentAction(proposalId: string, channel: "link" | "wa.me"): Promise<void> {
  const user = await requirePermission(permKey("CRM", "EDIT"));
  await markSent(proposalId, user.organizationId, user.id, channel);
  revalidateQuotes(proposalId);
}

export async function duplicateQuoteAction(proposalId: string): Promise<{ ok: true; id: string } | Fail> {
  const user = await requirePermission(permKey("CRM", "CREATE"));
  const p = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId }, include: { items: true } });
  if (!p) return { ok: false, error: "Orçamento não encontrado." };
  const settings = await getPricingSettings(user.organizationId);
  const copy = await db.proposal.create({
    data: {
      organizationId: user.organizationId,
      createdByUserId: user.id,
      leadId: p.leadId,
      clientId: p.clientId,
      title: p.title.endsWith("(nova versão)") ? p.title : `${p.title} (nova versão)`,
      value: p.value,
      recipientName: p.recipientName,
      recipientPhone: p.recipientPhone,
      intro: p.intro,
      notes: p.notes,
      currency: p.currency,
      discountPercent: p.discountPercent,
      maxInstallments: p.maxInstallments,
      oneTimeTotal: p.oneTimeTotal,
      monthlyTotal: p.monthlyTotal,
      minMonths: p.minMonths,
      pricingSnapshot: settings.config as unknown as object,
      validUntil: new Date(Date.now() + settings.validityDays * 86400000),
      publicToken: newToken(),
      items: {
        create: p.items.map((i) => ({
          serviceId: i.serviceId,
          name: i.name,
          tagline: i.tagline,
          features: i.features,
          billing: i.billing,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          monthlyFee: i.monthlyFee,
          priceIsFrom: i.priceIsFrom,
          cardMode: i.cardMode,
          cardPrice: i.cardPrice,
          maxInstallments: i.maxInstallments,
          minMonths: i.minMonths,
          terms: i.terms,
          position: i.position,
        })),
      },
    },
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "PROPOSAL_CREATED", entityType: "Proposal", entityId: copy.id, metadata: { duplicatedFrom: p.id } });
  revalidateQuotes();
  return { ok: true, id: copy.id };
}

// Ajuste manual pela equipe (ex: o cliente recusou por telefone, ou reabrir).
export async function setQuoteStatusAction(proposalId: string, status: "RECUSADA" | "ENVIADA"): Promise<{ ok: true } | Fail> {
  const user = await requirePermission(permKey("CRM", "EDIT"));
  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId } });
  if (!proposal) return { ok: false, error: "Orçamento não encontrado." };
  if (proposal.status === "ACEITA") return { ok: false, error: "Orçamento aceito não pode mudar de status." };
  await db.proposal.update({
    where: { id: proposalId },
    data: status === "ENVIADA" ? { status, sentAt: proposal.sentAt ?? new Date(), response: null, respondedAt: null } : { status },
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "PROPOSAL_STATUS_CHANGED", entityType: "Proposal", entityId: proposalId, metadata: { from: proposal.status, to: status } });
  revalidateQuotes(proposalId);
  return { ok: true };
}
