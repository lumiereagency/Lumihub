"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { convertLeadToClient } from "@/lib/crm/convert";
import { leadSchema, LEAD_STAGES, CONTACT_OUTCOMES, type ContactOutcome } from "@/lib/validation/crm";
import { findLeadDuplicate } from "@/lib/crm/duplicates";
import type { ActionState } from "@/lib/actions/auth-actions";

type Stage = (typeof LEAD_STAGES)[number];

function parseLeadForm(formData: FormData) {
  return leadSchema.safeParse({
    company: formData.get("company"),
    contactName: formData.get("contactName"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    instagram: formData.get("instagram"),
    website: formData.get("website"),
    city: formData.get("city"),
    segment: formData.get("segment"),
    source: formData.get("source"),
    temperature: formData.get("temperature"),
    ownerUserId: formData.get("ownerUserId"),
    potentialValue: formData.get("potentialValue"),
    probability: formData.get("probability") || 0,
    stage: formData.get("stage") || "LEAD",
    nextContactAt: formData.get("nextContactAt"),
    notes: formData.get("notes"),
  });
}

// Só considera serviços da própria organização.
async function readServiceIds(organizationId: string, formData: FormData): Promise<string[] | null> {
  if (!formData.has("servicesField")) return null;
  const ids = formData.getAll("serviceIds").map(String).filter(Boolean);
  if (ids.length === 0) return [];
  const valid = await db.service.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true } });
  return valid.map((s) => s.id);
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("CRM", "CREATE"));

  const parsed = parseLeadForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const duplicate = await findLeadDuplicate(user.organizationId, parsed.data);
  if (duplicate) return { error: duplicate };

  const serviceIds = await readServiceIds(user.organizationId, formData);
  const lead = await db.lead.create({
    data: {
      organizationId: user.organizationId,
      ...parsed.data,
      createdByUserId: user.id,
      ...(serviceIds?.length ? { services: { create: serviceIds.map((serviceId) => ({ serviceId })) } } : {}),
    },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LEAD_CREATED",
    entityType: "Lead",
    entityId: lead.id,
    metadata: { company: lead.company },
  });

  revalidatePath("/crm");
  return { success: "Lead cadastrado." };
}

export async function updateLeadAction(
  leadId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("CRM", "EDIT"));

  const parsed = parseLeadForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId: user.organizationId } });
  if (!lead) {
    return { error: "Lead não encontrado." };
  }

  const duplicate = await findLeadDuplicate(user.organizationId, parsed.data, leadId);
  if (duplicate) return { error: duplicate };

  const d = parsed.data;
  const serviceIds = await readServiceIds(user.organizationId, formData);
  await db.$transaction(async (tx) => {
    // Campo apagado no formulário precisa virar vazio no banco (não "manter o antigo").
    await tx.lead.update({
      where: { id: leadId },
      data: {
        company: d.company,
        contactName: d.contactName ?? null,
        phone: d.phone ?? null,
        whatsapp: d.whatsapp ?? null,
        instagram: d.instagram ?? null,
        website: d.website ?? null,
        city: d.city ?? null,
        segment: d.segment ?? null,
        source: d.source ?? null,
        temperature: d.temperature ?? null,
        ownerUserId: d.ownerUserId ?? null,
        potentialValue: d.potentialValue ?? null,
        probability: d.probability,
        stage: d.stage,
        nextContactAt: d.nextContactAt ?? null,
        notes: d.notes ?? null,
      },
    });
    if (serviceIds) {
      await tx.leadServiceInterest.deleteMany({ where: { leadId } });
      if (serviceIds.length) await tx.leadServiceInterest.createMany({ data: serviceIds.map((serviceId) => ({ leadId, serviceId })) });
    }
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LEAD_UPDATED",
    entityType: "Lead",
    entityId: leadId,
  });

  revalidatePath("/crm");
  return { success: "Lead atualizado." };
}

export async function updateLeadStageAction(leadId: string, stage: string) {
  const user = await requirePermission(permKey("CRM", "EDIT"));

  if (!LEAD_STAGES.includes(stage as Stage)) return;

  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId: user.organizationId } });
  if (!lead) return;

  await db.lead.update({
    where: { id: leadId },
    data: { stage: stage as Stage, lastContactAt: new Date() },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LEAD_STAGE_CHANGED",
    entityType: "Lead",
    entityId: leadId,
    metadata: { from: lead.stage, to: stage },
  });

  revalidatePath("/crm");
}

// Etapa para onde cada resultado de contato leva — só avança, nunca volta.
const OUTCOME_STAGE: Record<ContactOutcome, Stage | null> = {
  SEM_RESPOSTA: "CONTATO",
  CONVERSOU: "CONTATO",
  REUNIAO: "REUNIAO",
  PROPOSTA: "PROPOSTA",
  SEM_INTERESSE: "PERDIDO",
};

export async function logLeadContactAction(
  leadId: string,
  outcome: string,
  nextInDays: number | null,
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requirePermission(permKey("CRM", "EDIT"));
  if (!CONTACT_OUTCOMES.includes(outcome as ContactOutcome)) return { ok: false, error: "Escolha o resultado do contato." };

  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId: user.organizationId, deletedAt: null } });
  if (!lead) return { ok: false, error: "Lead não encontrado." };

  const target = OUTCOME_STAGE[outcome as ContactOutcome];
  const closed = lead.stage === "FECHADO" || lead.stage === "PERDIDO";
  let stage: Stage = lead.stage;
  if (target === "PERDIDO") stage = "PERDIDO";
  else if (target && !closed && LEAD_STAGES.indexOf(target) > LEAD_STAGES.indexOf(lead.stage)) stage = target;

  const now = new Date();
  let nextContactAt: Date | null = null;
  if (nextInDays !== null && stage !== "PERDIDO" && Number.isFinite(nextInDays) && nextInDays >= 0 && nextInDays <= 365) {
    nextContactAt = new Date(now.getTime() + nextInDays * 86400000);
    nextContactAt.setUTCHours(12, 0, 0, 0);
  }

  await db.lead.update({
    where: { id: leadId },
    data: { lastContactAt: now, nextContactAt, stage, ownerUserId: lead.ownerUserId ?? user.id },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LEAD_CONTACTED",
    entityType: "Lead",
    entityId: leadId,
    metadata: {
      company: lead.company,
      outcome,
      note: note.trim().slice(0, 1000) || undefined,
      nextContactAt: nextContactAt?.toISOString(),
      ...(stage !== lead.stage ? { from: lead.stage, to: stage } : {}),
    },
  });

  revalidatePath("/crm");
  return { ok: true };
}

export interface LeadHistoryItem {
  id: string;
  action: string;
  userName: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export async function getLeadHistoryAction(leadId: string): Promise<LeadHistoryItem[]> {
  const user = await requirePermission(permKey("CRM", "VIEW"));
  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId: user.organizationId }, select: { id: true } });
  if (!lead) return [];
  const logs = await db.auditLog.findMany({
    where: { organizationId: user.organizationId, entityType: "Lead", entityId: leadId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { user: { select: { name: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    userName: l.user?.name ?? "Sistema",
    createdAt: l.createdAt.toISOString(),
    metadata: (l.metadata ?? {}) as Record<string, unknown>,
  }));
}

export async function deleteLeadAction(leadId: string) {
  const user = await requirePermission(permKey("CRM", "DELETE"));

  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId: user.organizationId } });
  if (!lead) return;

  await db.lead.update({ where: { id: leadId }, data: { deletedAt: new Date() } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LEAD_DELETED",
    entityType: "Lead",
    entityId: leadId,
    metadata: { company: lead.company },
  });

  revalidatePath("/crm");
}

// Converte um lead fechado em cliente real (Fase 26 — princípio de integração
// entre módulos): cria o registro em Client preservando os dados comerciais,
// o histórico e os serviços de interesse, e vincula o lead ao cliente gerado.
export async function convertLeadToClientAction(leadId: string) {
  const user = await requirePermission(permKey("CRM", "MANAGE"));

  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId: user.organizationId } });
  if (!lead || lead.convertedClientId) return;

  const converted = await convertLeadToClient(user.organizationId, leadId);
  if (!converted) return;
  const client = { id: converted.clientId };

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LEAD_CONVERTED_TO_CLIENT",
    entityType: "Lead",
    entityId: leadId,
    metadata: { clientId: client.id, company: lead.company },
  });

  revalidatePath("/crm");
  revalidatePath("/clientes");
}

// Aviso em tempo real no formulário, antes de salvar.
export async function checkLeadDuplicateAction(company: string, instagram: string, excludeId?: string): Promise<string | null> {
  const user = await requirePermission(permKey("CRM", "VIEW"));
  if (!company.trim() && !instagram.trim()) return null;
  return findLeadDuplicate(user.organizationId, { company, instagram }, excludeId);
}
