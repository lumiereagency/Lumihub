"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { investmentSchema } from "@/lib/validation/investments";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function createInvestmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("INVESTMENTS", "CREATE"));

  const parsed = investmentSchema.safeParse({
    description: formData.get("description"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    paymentMethod: formData.get("paymentMethod"),
    installments: formData.get("installments") || 1,
    objective: formData.get("objective"),
    expectedReturn: formData.get("expectedReturn"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const investment = await db.$transaction(async (tx) => {
    const movement = await tx.financialMovement.create({
      data: {
        organizationId: user.organizationId,
        type: "INVESTIMENTO",
        amount: parsed.data.amount,
        competenceDate: parsed.data.date,
        paidAt: parsed.data.date,
        status: "PAGO",
        paymentMethod: parsed.data.paymentMethod,
        notes: parsed.data.description,
      },
    });

    return tx.investment.create({
      data: { organizationId: user.organizationId, movementId: movement.id, ...parsed.data },
    });
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "INVESTMENT_CREATED",
    entityType: "Investment",
    entityId: investment.id,
  });

  revalidatePath("/financeiro/investimentos");
  revalidatePath("/financeiro");
  return { success: "Investimento registrado." };
}
