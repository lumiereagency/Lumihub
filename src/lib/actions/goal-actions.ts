"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { goalSchema } from "@/lib/validation/goals";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function createGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("GOALS", "CREATE"));

  const parsed = goalSchema.safeParse({
    type: formData.get("type"),
    scenario: formData.get("scenario"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    targetValue: formData.get("targetValue"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const existing = await db.goal.findFirst({
    where: {
      organizationId: user.organizationId,
      type: parsed.data.type,
      scenario: parsed.data.scenario,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
    },
  });
  if (existing) {
    return { error: "Já existe uma meta desse tipo, cenário e período. Edite a meta existente." };
  }

  const goal = await db.goal.create({
    data: { organizationId: user.organizationId, ...parsed.data },
  });

  await audit({ organizationId: user.organizationId, userId: user.id, action: "GOAL_CREATED", entityType: "Goal", entityId: goal.id });

  revalidatePath("/metas");
  return { success: "Meta criada." };
}

export async function updateGoalAction(goalId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("GOALS", "EDIT"));

  const targetValue = Number(formData.get("targetValue"));
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    return { error: "Informe um valor maior que zero." };
  }

  const goal = await db.goal.findFirst({ where: { id: goalId, organizationId: user.organizationId } });
  if (!goal) return { error: "Meta não encontrada." };

  await db.goal.update({ where: { id: goalId }, data: { targetValue } });

  await audit({ organizationId: user.organizationId, userId: user.id, action: "GOAL_UPDATED", entityType: "Goal", entityId: goalId });

  revalidatePath("/metas");
  return { success: "Meta atualizada." };
}

export async function deleteGoalAction(goalId: string): Promise<void> {
  const user = await requirePermission(permKey("GOALS", "DELETE"));

  const goal = await db.goal.findFirst({ where: { id: goalId, organizationId: user.organizationId } });
  if (!goal) return;

  await db.goal.delete({ where: { id: goalId } });

  await audit({ organizationId: user.organizationId, userId: user.id, action: "GOAL_DELETED", entityType: "Goal", entityId: goalId });

  revalidatePath("/metas");
}
