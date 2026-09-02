"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { creditCardSchema, cardTransactionSchema } from "@/lib/validation/cards";
import type { ActionState } from "@/lib/actions/auth-actions";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function createCreditCardAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("CARDS", "CREATE"));

  const parsed = creditCardSchema.safeParse({
    name: formData.get("name"),
    institution: formData.get("institution"),
    limitAmount: formData.get("limitAmount"),
    closingDay: formData.get("closingDay"),
    dueDay: formData.get("dueDay"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const card = await db.creditCard.create({ data: { organizationId: user.organizationId, ...parsed.data } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CREDIT_CARD_CREATED",
    entityType: "CreditCard",
    entityId: card.id,
  });

  revalidatePath("/financeiro/cartoes");
  return { success: "Cartão cadastrado." };
}

export async function toggleCreditCardActiveAction(cardId: string, active: boolean) {
  const user = await requirePermission(permKey("CARDS", "EDIT"));
  const card = await db.creditCard.findFirst({ where: { id: cardId, organizationId: user.organizationId } });
  if (!card) return;
  await db.creditCard.update({ where: { id: cardId }, data: { active } });
  revalidatePath("/financeiro/cartoes");
}

// Distribui uma compra automaticamente nas faturas futuras (Fase 10):
// se a compra ocorreu após o fechamento, a primeira parcela cai na fatura
// do mês seguinte; cada parcela subsequente avança um mês.
export async function createCardTransactionAction(cardId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("CARDS", "CREATE"));

  const parsed = cardTransactionSchema.safeParse({
    description: formData.get("description"),
    category: formData.get("category"),
    totalAmount: formData.get("totalAmount"),
    purchaseDate: formData.get("purchaseDate"),
    installmentsTotal: formData.get("installmentsTotal") || 1,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const card = await db.creditCard.findFirst({ where: { id: cardId, organizationId: user.organizationId } });
  if (!card) return { error: "Cartão não encontrado." };

  const purchaseDay = parsed.data.purchaseDate.getDate();
  const firstInvoiceOffset = purchaseDay > card.closingDay ? 1 : 0;
  const baseInvoiceMonth = addMonths(parsed.data.purchaseDate, firstInvoiceOffset);
  const installmentAmount = Math.round((parsed.data.totalAmount / parsed.data.installmentsTotal) * 100) / 100;

  await db.$transaction(async (tx) => {
    const transaction = await tx.creditCardTransaction.create({
      data: {
        cardId,
        description: parsed.data.description,
        category: parsed.data.category,
        totalAmount: parsed.data.totalAmount,
        purchaseDate: parsed.data.purchaseDate,
        installmentsTotal: parsed.data.installmentsTotal,
      },
    });

    for (let i = 0; i < parsed.data.installmentsTotal; i++) {
      const invoiceMonth = addMonths(baseInvoiceMonth, i);
      const dueDate = new Date(invoiceMonth.getFullYear(), invoiceMonth.getMonth(), card.dueDay);

      const movement = await tx.financialMovement.create({
        data: {
          organizationId: user.organizationId,
          type: "PARCELA",
          amount: installmentAmount,
          competenceDate: dueDate,
          dueDate,
          status: "PENDENTE",
          installmentNumber: i + 1,
          installmentTotal: parsed.data.installmentsTotal,
          notes: `${card.name} — ${parsed.data.description}${parsed.data.installmentsTotal > 1 ? ` (${i + 1}/${parsed.data.installmentsTotal})` : ""}`,
        },
      });

      await tx.creditCardInstallment.create({
        data: {
          transactionId: transaction.id,
          movementId: movement.id,
          number: i + 1,
          amount: installmentAmount,
          invoiceMonth: new Date(invoiceMonth.getFullYear(), invoiceMonth.getMonth(), 1),
        },
      });
    }
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CARD_TRANSACTION_CREATED",
    entityType: "CreditCard",
    entityId: cardId,
    metadata: { description: parsed.data.description, installments: parsed.data.installmentsTotal },
  });

  revalidatePath("/financeiro/cartoes");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo-de-caixa");
  revalidatePath("/dashboard");
  return { success: "Compra lançada e distribuída nas faturas." };
}

export async function toggleInstallmentPaidAction(installmentId: string, paid: boolean) {
  const user = await requirePermission(permKey("CARDS", "EDIT"));

  const installment = await db.creditCardInstallment.findFirst({
    where: { id: installmentId, transaction: { card: { organizationId: user.organizationId } } },
  });
  if (!installment) return;

  await db.$transaction(async (tx) => {
    await tx.creditCardInstallment.update({ where: { id: installmentId }, data: { paid } });
    if (installment.movementId) {
      await tx.financialMovement.update({
        where: { id: installment.movementId },
        data: { status: paid ? "PAGO" : "PENDENTE", paidAt: paid ? new Date() : null },
      });
    }
  });

  revalidatePath("/financeiro/cartoes");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/fluxo-de-caixa");
}
