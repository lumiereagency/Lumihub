"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { receivableSchema, confirmPaymentSchema } from "@/lib/validation/receivables";
import { generateRemindersForReceivable } from "@/lib/billing/reminders";
import type { ActionState } from "@/lib/actions/auth-actions";

function parseReceivableForm(formData: FormData) {
  return receivableSchema.safeParse({
    clientId: formData.get("clientId"),
    contractId: formData.get("contractId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
    paymentMethod: formData.get("paymentMethod"),
    notes: formData.get("notes"),
  });
}

export async function createReceivableAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("RECEIVABLES", "CREATE"));

  const parsed = parseReceivableForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const client = await db.client.findFirst({ where: { id: parsed.data.clientId, organizationId: user.organizationId } });
  if (!client) return { error: "Cliente não encontrado." };

  const receivable = await db.$transaction(async (tx) => {
    const movement = await tx.financialMovement.create({
      data: {
        organizationId: user.organizationId,
        type: "RECEITA",
        amount: parsed.data.amount,
        competenceDate: parsed.data.dueDate,
        dueDate: parsed.data.dueDate,
        clientId: parsed.data.clientId,
        contractId: parsed.data.contractId,
        paymentMethod: parsed.data.paymentMethod,
        status: "PENDENTE",
        notes: parsed.data.notes,
      },
    });

    const created = await tx.accountReceivable.create({
      data: {
        organizationId: user.organizationId,
        clientId: parsed.data.clientId,
        contractId: parsed.data.contractId,
        movementId: movement.id,
        description: parsed.data.description,
        amount: parsed.data.amount,
        dueDate: parsed.data.dueDate,
        paymentMethod: parsed.data.paymentMethod,
        notes: parsed.data.notes,
        status: "PENDENTE",
      },
    });

    await generateRemindersForReceivable(tx, created.id);
    return created;
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "RECEIVABLE_CREATED",
    entityType: "AccountReceivable",
    entityId: receivable.id,
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro/cobrancas");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/dashboard");
  return { success: "Cobrança criada." };
}

export async function updateReceivableAction(
  receivableId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("RECEIVABLES", "EDIT"));

  const parsed = parseReceivableForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const existing = await db.accountReceivable.findFirst({ where: { id: receivableId, organizationId: user.organizationId } });
  if (!existing) return { error: "Cobrança não encontrada." };
  if (existing.status !== "PENDENTE" && existing.status !== "ATRASADO") {
    return { error: "Apenas cobranças pendentes podem ser editadas." };
  }

  const dueDateChanged = existing.dueDate.getTime() !== parsed.data.dueDate.getTime();

  await db.$transaction(async (tx) => {
    await tx.accountReceivable.update({ where: { id: receivableId }, data: parsed.data });
    if (existing.movementId) {
      await tx.financialMovement.update({
        where: { id: existing.movementId },
        data: {
          amount: parsed.data.amount,
          dueDate: parsed.data.dueDate,
          competenceDate: parsed.data.dueDate,
          contractId: parsed.data.contractId,
          paymentMethod: parsed.data.paymentMethod,
          notes: parsed.data.notes,
        },
      });
    }
    if (dueDateChanged) {
      await tx.paymentReminder.deleteMany({ where: { receivableId, status: "AGENDADO" } });
      await generateRemindersForReceivable(tx, receivableId);
    }
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "RECEIVABLE_UPDATED",
    entityType: "AccountReceivable",
    entityId: receivableId,
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro/cobrancas");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/dashboard");
  return { success: "Cobrança atualizada." };
}

export async function confirmPaymentAction(
  receivableId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("RECEIVABLES", "EDIT"));

  const parsed = confirmPaymentSchema.safeParse({
    paidAt: formData.get("paidAt"),
    paymentMethod: formData.get("paymentMethod"),
    proofUrl: formData.get("proofUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const existing = await db.accountReceivable.findFirst({ where: { id: receivableId, organizationId: user.organizationId } });
  if (!existing) return { error: "Cobrança não encontrada." };

  await db.$transaction(async (tx) => {
    await tx.accountReceivable.update({
      where: { id: receivableId },
      data: { status: "PAGO", paidAt: parsed.data.paidAt, paymentMethod: parsed.data.paymentMethod, proofUrl: parsed.data.proofUrl },
    });
    if (existing.movementId) {
      await tx.financialMovement.update({
        where: { id: existing.movementId },
        data: { status: "PAGO", paidAt: parsed.data.paidAt, paymentMethod: parsed.data.paymentMethod },
      });
    }
    await tx.paymentReminder.updateMany({
      where: { receivableId, status: "AGENDADO" },
      data: { status: "CANCELADO" },
    });
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "RECEIVABLE_PAID",
    entityType: "AccountReceivable",
    entityId: receivableId,
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro/cobrancas");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/dashboard");
  return { success: "Pagamento confirmado." };
}

// Desfazer pagamento (Fase 46): corrige lançamentos marcados como Pago por
// engano — volta pra Pendente, tira do Saldo atual (que só soma o que está
// Pago) e reabre a régua de lembretes.
export async function undoPaymentAction(receivableId: string) {
  const user = await requirePermission(permKey("RECEIVABLES", "EDIT"));

  const existing = await db.accountReceivable.findFirst({ where: { id: receivableId, organizationId: user.organizationId } });
  if (!existing || existing.status !== "PAGO") return;

  await db.$transaction(async (tx) => {
    await tx.accountReceivable.update({
      where: { id: receivableId },
      data: { status: "PENDENTE", paidAt: null, proofUrl: null },
    });
    if (existing.movementId) {
      await tx.financialMovement.update({
        where: { id: existing.movementId },
        data: { status: "PENDENTE", paidAt: null },
      });
    }
    await tx.paymentReminder.deleteMany({ where: { receivableId } });
    await generateRemindersForReceivable(tx, receivableId);
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "RECEIVABLE_PAYMENT_UNDONE",
    entityType: "AccountReceivable",
    entityId: receivableId,
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro/cobrancas");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/dashboard");
}

export async function cancelReceivableAction(receivableId: string) {
  const user = await requirePermission(permKey("RECEIVABLES", "DELETE"));

  const existing = await db.accountReceivable.findFirst({ where: { id: receivableId, organizationId: user.organizationId } });
  if (!existing) return;

  await db.$transaction(async (tx) => {
    await tx.accountReceivable.update({ where: { id: receivableId }, data: { status: "CANCELADO" } });
    if (existing.movementId) {
      await tx.financialMovement.update({ where: { id: existing.movementId }, data: { status: "CANCELADO" } });
    }
    await tx.paymentReminder.updateMany({ where: { receivableId, status: "AGENDADO" }, data: { status: "CANCELADO" } });
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "RECEIVABLE_CANCELLED",
    entityType: "AccountReceivable",
    entityId: receivableId,
  });

  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro/cobrancas");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/dashboard");
}
