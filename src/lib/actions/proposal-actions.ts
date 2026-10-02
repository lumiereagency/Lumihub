"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";

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
  revalidatePath("/crm");
}
