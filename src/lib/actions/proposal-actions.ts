"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { proposalSchema, PROPOSAL_STATUSES } from "@/lib/validation/proposals";
import { LEAD_STAGES } from "@/lib/validation/crm";
import type { ActionState } from "@/lib/actions/auth-actions";

function parseProposalForm(formData: FormData) {
  return proposalSchema.safeParse({
    title: formData.get("title"),
    leadId: formData.get("leadId"),
    clientId: formData.get("clientId"),
    value: formData.get("value"),
    validUntil: formData.get("validUntil"),
    notes: formData.get("notes"),
  });
}

// Fase 26 — enviar ou negociar uma proposta é um sinal comercial inequívoco:
// avança o estágio do lead vinculado se ele ainda não chegou lá. Nunca move
// o lead para trás nem o marca como perdido a partir de uma proposta recusada,
// já que um lead pode ter outras propostas em aberto.
async function syncLeadStageFromProposal(leadId: string | null | undefined, proposalStatus: string) {
  if (!leadId) return;

  const targetStage = proposalStatus === "ENVIADA" ? "PROPOSTA" : proposalStatus === "EM_NEGOCIACAO" ? "NEGOCIACAO" : null;
  if (!targetStage) return;

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  const targetIndex = LEAD_STAGES.indexOf(targetStage);
  const currentIndex = LEAD_STAGES.indexOf(lead.stage);
  if (currentIndex >= targetIndex) return;

  await db.lead.update({ where: { id: leadId }, data: { stage: targetStage, lastContactAt: new Date() } });
}

export async function createProposalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("CRM", "CREATE"));

  const parsed = parseProposalForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const proposal = await db.proposal.create({
    data: { organizationId: user.organizationId, ...parsed.data },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PROPOSAL_CREATED",
    entityType: "Proposal",
    entityId: proposal.id,
  });

  revalidatePath("/propostas");
  return { success: "Proposta criada." };
}

export async function updateProposalAction(proposalId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("CRM", "EDIT"));

  const parsed = parseProposalForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId } });
  if (!proposal) return { error: "Proposta não encontrada." };

  await db.proposal.update({ where: { id: proposalId }, data: parsed.data });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PROPOSAL_UPDATED",
    entityType: "Proposal",
    entityId: proposalId,
  });

  revalidatePath("/propostas");
  return { success: "Proposta atualizada." };
}

export async function updateProposalStatusAction(proposalId: string, status: string) {
  const user = await requirePermission(permKey("CRM", "EDIT"));

  if (!PROPOSAL_STATUSES.includes(status as (typeof PROPOSAL_STATUSES)[number])) return;

  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId } });
  if (!proposal) return;

  const typedStatus = status as (typeof PROPOSAL_STATUSES)[number];

  await db.proposal.update({
    where: { id: proposalId },
    data: {
      status: typedStatus,
      sentAt: typedStatus === "ENVIADA" && !proposal.sentAt ? new Date() : proposal.sentAt,
    },
  });

  await syncLeadStageFromProposal(proposal.leadId, typedStatus);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PROPOSAL_STATUS_CHANGED",
    entityType: "Proposal",
    entityId: proposalId,
    metadata: { from: proposal.status, to: status },
  });

  revalidatePath("/propostas");
  revalidatePath("/crm");
}

export async function deleteProposalAction(proposalId: string) {
  const user = await requirePermission(permKey("CRM", "DELETE"));

  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId } });
  if (!proposal) return;

  await db.proposal.delete({ where: { id: proposalId } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PROPOSAL_DELETED",
    entityType: "Proposal",
    entityId: proposalId,
  });

  revalidatePath("/propostas");
}
