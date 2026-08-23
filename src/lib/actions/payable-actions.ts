"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { payableSchema, confirmPayableSchema } from "@/lib/validation/payables";
import type { ActionState } from "@/lib/actions/auth-actions";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function parsePayableForm(formData: FormData) {
  return payableSchema.safeParse({
    description: formData.get("description"),
    supplier: formData.get("supplier"),
    categoryId: formData.get("categoryId"),
    costCenterId: formData.get("costCenterId"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
    recurring: formData.get("recurring") === "on",
    installmentTotal: formData.get("installmentTotal"),
    responsibleUserId: formData.get("responsibleUserId"),
  });
}

export async function createPayableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("PAYABLES", "CREATE"));

  const parsed = parsePayableForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const installmentTotal = parsed.data.installmentTotal ?? 1;
  const installmentGroupId = installmentTotal > 1 ? randomUUID() : null;
  const installmentAmount = installmentTotal > 1 ? Math.round((parsed.data.amount / installmentTotal) * 100) / 100 : parsed.data.amount;

  await db.$transaction(async (tx) => {
    for (let i = 0; i < installmentTotal; i++) {
      const dueDate = addMonths(parsed.data.dueDate, i);
      const movement = await tx.financialMovement.create({
        data: {
          organizationId: user.organizationId,
          type: "DESPESA",
          amount: installmentAmount,
          competenceDate: dueDate,
          dueDate,
          categoryId: parsed.data.categoryId,
          costCenterId: parsed.data.costCenterId,
          status: "PENDENTE",
          installmentGroupId: installmentGroupId ?? undefined,
          installmentNumber: installmentTotal > 1 ? i + 1 : undefined,
          installmentTotal: installmentTotal > 1 ? installmentTotal : undefined,
          notes: parsed.data.supplier ? `Fornecedor: ${parsed.data.supplier}` : undefined,
        },
      });

      await tx.accountPayable.create({
        data: {
          organizationId: user.organizationId,
          movementId: movement.id,
          description: installmentTotal > 1 ? `${parsed.data.description} (${i + 1}/${installmentTotal})` : parsed.data.description,
          supplier: parsed.data.supplier,
          categoryId: parsed.data.categoryId,
          costCenterId: parsed.data.costCenterId,
          amount: installmentAmount,
          dueDate,
          recurring: parsed.data.recurring && installmentTotal === 1,
          installmentGroupId: installmentGroupId ?? undefined,
          installmentNumber: installmentTotal > 1 ? i + 1 : undefined,
          installmentTotal: installmentTotal > 1 ? installmentTotal : undefined,
          responsibleUserId: parsed.data.responsibleUserId,
          status: "PENDENTE",
        },
      });
    }
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYABLE_CREATED",
    entityType: "AccountPayable",
    metadata: { description: parsed.data.description, installments: installmentTotal },
  });

  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  return { success: installmentTotal > 1 ? `${installmentTotal} parcelas criadas.` : "Conta a pagar criada." };
}

export async function updatePayableAction(payableId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("PAYABLES", "EDIT"));

  const parsed = payableSchema.safeParse({
    description: formData.get("description"),
    supplier: formData.get("supplier"),
    categoryId: formData.get("categoryId"),
    costCenterId: formData.get("costCenterId"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
    recurring: formData.get("recurring") === "on",
    installmentTotal: undefined,
    responsibleUserId: formData.get("responsibleUserId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const existing = await db.accountPayable.findFirst({ where: { id: payableId, organizationId: user.organizationId } });
  if (!existing) return { error: "Conta a pagar não encontrada." };
  if (existing.status !== "PENDENTE" && existing.status !== "ATRASADO") {
    return { error: "Apenas contas pendentes podem ser editadas." };
  }

  await db.$transaction(async (tx) => {
    await tx.accountPayable.update({
      where: { id: payableId },
      data: {
        description: parsed.data.description,
        supplier: parsed.data.supplier,
        categoryId: parsed.data.categoryId,
        costCenterId: parsed.data.costCenterId,
        amount: parsed.data.amount,
        dueDate: parsed.data.dueDate,
        recurring: parsed.data.recurring,
        responsibleUserId: parsed.data.responsibleUserId,
      },
    });
    if (existing.movementId) {
      await tx.financialMovement.update({
        where: { id: existing.movementId },
        data: {
          amount: parsed.data.amount,
          dueDate: parsed.data.dueDate,
          competenceDate: parsed.data.dueDate,
          categoryId: parsed.data.categoryId,
          costCenterId: parsed.data.costCenterId,
        },
      });
    }
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYABLE_UPDATED",
    entityType: "AccountPayable",
    entityId: payableId,
  });

  revalidatePath("/financeiro/pagar");
  return { success: "Conta a pagar atualizada." };
}

export async function confirmPayablePaymentAction(
  payableId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("PAYABLES", "EDIT"));

  const parsed = confirmPayableSchema.safeParse({ paidAt: formData.get("paidAt") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const existing = await db.accountPayable.findFirst({ where: { id: payableId, organizationId: user.organizationId } });
  if (!existing) return { error: "Conta a pagar não encontrada." };

  await db.$transaction(async (tx) => {
    await tx.accountPayable.update({ where: { id: payableId }, data: { status: "PAGO", paidAt: parsed.data.paidAt } });
    if (existing.movementId) {
      await tx.financialMovement.update({ where: { id: existing.movementId }, data: { status: "PAGO", paidAt: parsed.data.paidAt } });
    }

    // Conta recorrente paga → gera automaticamente a próxima ocorrência
    // (sem infraestrutura de cron, este é o gatilho real disponível).
    if (existing.recurring) {
      const nextDueDate = addMonths(existing.dueDate, 1);
      const movement = await tx.financialMovement.create({
        data: {
          organizationId: user.organizationId,
          type: "DESPESA",
          amount: existing.amount,
          competenceDate: nextDueDate,
          dueDate: nextDueDate,
          categoryId: existing.categoryId,
          costCenterId: existing.costCenterId,
          status: "PENDENTE",
        },
      });
      await tx.accountPayable.create({
        data: {
          organizationId: user.organizationId,
          movementId: movement.id,
          description: existing.description,
          supplier: existing.supplier,
          categoryId: existing.categoryId,
          costCenterId: existing.costCenterId,
          amount: existing.amount,
          dueDate: nextDueDate,
          recurring: true,
          responsibleUserId: existing.responsibleUserId,
          status: "PENDENTE",
        },
      });
    }
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYABLE_PAID",
    entityType: "AccountPayable",
    entityId: payableId,
  });

  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  return { success: "Pagamento confirmado." };
}

export async function cancelPayableAction(payableId: string) {
  const user = await requirePermission(permKey("PAYABLES", "DELETE"));

  const existing = await db.accountPayable.findFirst({ where: { id: payableId, organizationId: user.organizationId } });
  if (!existing) return;

  await db.$transaction(async (tx) => {
    await tx.accountPayable.update({ where: { id: payableId }, data: { status: "CANCELADO" } });
    if (existing.movementId) {
      await tx.financialMovement.update({ where: { id: existing.movementId }, data: { status: "CANCELADO" } });
    }
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PAYABLE_CANCELLED",
    entityType: "AccountPayable",
    entityId: payableId,
  });

  revalidatePath("/financeiro/pagar");
}
