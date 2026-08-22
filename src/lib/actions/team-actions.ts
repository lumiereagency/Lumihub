"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { teamMemberSchema } from "@/lib/validation/team";
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

  const member = await db.teamMember.create({
    data: { organizationId: user.organizationId, ...parsed.data },
  });

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

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TEAM_MEMBER_UPDATED",
    entityType: "TeamMember",
    entityId: memberId,
  });

  revalidatePath("/equipe");
  revalidatePath("/equipe/freelancers");
  return { success: "Membro da equipe atualizado." };
}
