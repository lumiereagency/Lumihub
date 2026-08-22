"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { leadSchema, LEAD_STAGES } from "@/lib/validation/crm";
import type { ActionState } from "@/lib/actions/auth-actions";

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
    ownerUserId: formData.get("ownerUserId"),
    potentialValue: formData.get("potentialValue"),
    probability: formData.get("probability") || 0,
    stage: formData.get("stage") || "LEAD",
    nextContactAt: formData.get("nextContactAt"),
    notes: formData.get("notes"),
  });
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("CRM", "CREATE"));

  const parsed = parseLeadForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const lead = await db.lead.create({
    data: { organizationId: user.organizationId, ...parsed.data },
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

  await db.lead.update({ where: { id: leadId }, data: parsed.data });

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

  if (!LEAD_STAGES.includes(stage as (typeof LEAD_STAGES)[number])) return;

  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId: user.organizationId } });
  if (!lead) return;

  await db.lead.update({
    where: { id: leadId },
    data: { stage: stage as (typeof LEAD_STAGES)[number], lastContactAt: new Date() },
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
  });

  revalidatePath("/crm");
}

// Converte um lead fechado em cliente real (Fase 26 — princípio de integração
// entre módulos): cria o registro em Client preservando os dados comerciais
// e o histórico, e vincula o lead ao cliente gerado.
export async function convertLeadToClientAction(leadId: string) {
  const user = await requirePermission(permKey("CRM", "MANAGE"));

  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId: user.organizationId } });
  if (!lead || lead.convertedClientId) return;

  const client = await db.$transaction(async (tx) => {
    const createdClient = await tx.client.create({
      data: {
        organizationId: user.organizationId,
        companyName: lead.company,
        contactName: lead.contactName,
        phone: lead.phone,
        instagram: lead.instagram,
        website: lead.website,
        status: "ATIVO",
        notes: lead.notes,
      },
    });

    await tx.lead.update({
      where: { id: leadId },
      data: { stage: "FECHADO", convertedClientId: createdClient.id },
    });

    return createdClient;
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LEAD_CONVERTED_TO_CLIENT",
    entityType: "Lead",
    entityId: leadId,
    metadata: { clientId: client.id },
  });

  revalidatePath("/crm");
}
