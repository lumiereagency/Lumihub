"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { financialCategorySchema, costCenterSchema } from "@/lib/validation/finance";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function createFinancialCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("FINANCE", "MANAGE"));

  const parsed = financialCategorySchema.safeParse({ name: formData.get("name"), type: formData.get("type") || "DESPESA" });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const category = await db.financialCategory.create({ data: { organizationId: user.organizationId, ...parsed.data } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "FINANCIAL_CATEGORY_CREATED",
    entityType: "FinancialCategory",
    entityId: category.id,
  });

  revalidatePath("/financeiro");
  return { success: "Categoria criada." };
}

export async function deleteFinancialCategoryAction(categoryId: string) {
  const user = await requirePermission(permKey("FINANCE", "MANAGE"));

  const category = await db.financialCategory.findFirst({ where: { id: categoryId, organizationId: user.organizationId } });
  if (!category) return;

  await db.financialCategory.delete({ where: { id: categoryId } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "FINANCIAL_CATEGORY_DELETED",
    entityType: "FinancialCategory",
    entityId: categoryId,
  });

  revalidatePath("/financeiro");
}

export async function createCostCenterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("FINANCE", "MANAGE"));

  const parsed = costCenterSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const costCenter = await db.costCenter.create({ data: { organizationId: user.organizationId, ...parsed.data } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "COST_CENTER_CREATED",
    entityType: "CostCenter",
    entityId: costCenter.id,
  });

  revalidatePath("/financeiro");
  return { success: "Centro de custo criado." };
}

export async function deleteCostCenterAction(costCenterId: string) {
  const user = await requirePermission(permKey("FINANCE", "MANAGE"));

  const costCenter = await db.costCenter.findFirst({ where: { id: costCenterId, organizationId: user.organizationId } });
  if (!costCenter) return;

  await db.costCenter.delete({ where: { id: costCenterId } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "COST_CENTER_DELETED",
    entityType: "CostCenter",
    entityId: costCenterId,
  });

  revalidatePath("/financeiro");
}
