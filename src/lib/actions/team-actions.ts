"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { teamMemberSchema } from "@/lib/validation/team";
import { syncPayroll } from "@/lib/payroll/folha";
import type { ActionState } from "@/lib/actions/auth-actions";

function parseTeamMemberForm(formData: FormData) {
  return teamMemberSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
    type: formData.get("type") || "FUNCIONARIO",
    userId: formData.get("userId"),
    paymentValue: formData.get("paymentValue"),
    paymentMethod: formData.get("paymentMethod"),
    paymentDay: formData.get("paymentDay"),
    paymentDayMode: formData.get("paymentDayMode") || "FIXED",
    active: formData.get("active") === "on",
  });
}

export async function createTeamMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("TEAM", "CREATE"));

  const parsed = parseTeamMemberForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  if (parsed.data.userId) {
    const linked = await db.teamMember.findUnique({ where: { userId: parsed.data.userId } });
    if (linked) {
      return { error: "Este usuário já está vinculado a outro membro da equipe." };
    }
  }

  const member = await db.teamMember.create({ data: { organizationId: user.organizationId, ...parsed.data } });
  await syncPayroll(user.organizationId);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TEAM_MEMBER_CREATED",
    entityType: "TeamMember",
    entityId: member.id,
    metadata: { name: member.name, type: member.type },
  });

  revalidatePath("/equipe");
  revalidatePath("/equipe/freelancers");
  revalidatePath("/financeiro/pagar");
  revalidatePath("/dashboard");
  return { success: "Membro da equipe cadastrado." };
}

export async function updateTeamMemberAction(
  memberId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("TEAM", "EDIT"));

  const parsed = parseTeamMemberForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const member = await db.teamMember.findFirst({ where: { id: memberId, organizationId: user.organizationId } });
  if (!member) {
    return { error: "Membro da equipe não encontrado." };
  }

  if (parsed.data.userId && parsed.data.userId !== member.userId) {
    const linked = await db.teamMember.findUnique({ where: { userId: parsed.data.userId } });
    if (linked) {
      return { error: "Este usuário já está vinculado a outro membro da equipe." };
    }
  }

  await db.teamMember.update({ where: { id: memberId }, data: parsed.data });
  await syncPayroll(user.organizationId);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TEAM_MEMBER_UPDATED",
    entityType: "TeamMember",
    entityId: memberId,
  });

  revalidatePath("/equipe");
  revalidatePath("/equipe/freelancers");
  revalidatePath("/financeiro/pagar");
  revalidatePath("/dashboard");
  return { success: "Membro da equipe atualizado." };
}

// Excluir da equipe: as folhas em aberto somem (cachês e comissões voltam a
// ficar sem folha) e o histórico do que já foi pago continua no financeiro.
export async function deleteTeamMemberAction(memberId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePermission(permKey("TEAM", "DELETE"));
  const member = await db.teamMember.findFirst({ where: { id: memberId, organizationId: user.organizationId } });
  if (!member) return { ok: false, error: "Membro da equipe não encontrado." };

  await db.$transaction(async (tx) => {
    const open = await tx.accountPayable.findMany({ where: { teamMemberId: memberId, status: { in: ["PENDENTE", "ATRASADO"] } } });
    for (const p of open) {
      await tx.commission.updateMany({ where: { payableId: p.id }, data: { payableId: null } });
      await tx.captureAssignment.updateMany({ where: { payableId: p.id }, data: { payableId: null } });
      await tx.accountPayable.delete({ where: { id: p.id } });
      if (p.movementId) await tx.financialMovement.delete({ where: { id: p.movementId } }).catch(() => {});
    }
    await tx.teamMember.delete({ where: { id: memberId } });
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TEAM_MEMBER_DELETED",
    entityType: "TeamMember",
    entityId: memberId,
    metadata: { name: member.name },
  });

  revalidatePath("/equipe");
  revalidatePath("/equipe/freelancers");
  revalidatePath("/financeiro/pagar");
  revalidatePath("/dashboard");
  return { ok: true };
}
