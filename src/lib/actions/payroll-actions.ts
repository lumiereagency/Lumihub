"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, isDirector, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { getPricingSettings } from "@/lib/pricing/settings";
import { FOLHA, onFolhaPaid, onFolhaUnpaid, syncPayroll } from "@/lib/payroll/folha";

function refresh() {
  revalidatePath("/equipe/pagamentos");
  revalidatePath("/financeiro/pagar");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  revalidatePath("/comissoes");
}

const settingsSchema = z.object({
  captureFeeSolo: z.number().min(0).max(100000),
  captureFeeShared: z.number().min(0).max(100000),
  taxRate: z.number().min(0).max(50),
  taxDueDay: z.number().int().min(1).max(28),
});

// Valores de cachê e imposto (só a diretoria).
export async function updatePayrollSettingsAction(input: z.input<typeof settingsSchema>): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!isDirector(user)) return { ok: false, error: "Só a diretoria altera estes valores." };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os valores." };
  const current = await getPricingSettings(user.organizationId);
  await db.pricingSettings.upsert({
    where: { organizationId: user.organizationId },
    create: {
      organizationId: user.organizationId,
      installmentFees: current.config.rows as object,
      debitFee: current.config.debitFee,
      creditMargin: current.config.creditMargin,
      maxInstallments: current.config.maxInstallments,
      ...parsed.data,
    },
    update: parsed.data,
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "PAYROLL_SETTINGS_UPDATED", entityType: "PricingSettings", metadata: parsed.data });
  refresh();
  revalidatePath("/captacoes");
  return { ok: true };
}

async function requirePayer() {
  const user = await requireUser();
  if (!isDirector(user) && !hasPermission(user, permKey("PAYABLES", "EDIT"))) return null;
  return user;
}

export async function payFolhaAction(payableId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePayer();
  if (!user) return { ok: false, error: "Sem permissão para registrar pagamentos." };
  const p = await db.accountPayable.findFirst({ where: { id: payableId, organizationId: user.organizationId, kind: FOLHA } });
  if (!p) return { ok: false, error: "Folha não encontrada." };
  if (p.status === "PAGO") return { ok: true };
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.accountPayable.update({ where: { id: p.id }, data: { status: "PAGO", paidAt: now } });
    if (p.movementId) await tx.financialMovement.update({ where: { id: p.movementId }, data: { status: "PAGO", paidAt: now } });
    await onFolhaPaid(tx, p.id, now, user.id);
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "PAYROLL_PAID", entityType: "AccountPayable", entityId: p.id, metadata: { amount: Number(p.amount) } });
  await syncPayroll(user.organizationId);
  refresh();
  return { ok: true };
}

export async function undoFolhaAction(payableId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePayer();
  if (!user) return { ok: false, error: "Sem permissão." };
  const p = await db.accountPayable.findFirst({ where: { id: payableId, organizationId: user.organizationId, kind: FOLHA, status: "PAGO" } });
  if (!p) return { ok: false, error: "Folha não encontrada." };
  await db.$transaction(async (tx) => {
    await tx.accountPayable.update({ where: { id: p.id }, data: { status: "PENDENTE", paidAt: null } });
    if (p.movementId) await tx.financialMovement.update({ where: { id: p.movementId }, data: { status: "PENDENTE", paidAt: null } });
    await onFolhaUnpaid(tx, p.id);
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "PAYROLL_PAYMENT_UNDONE", entityType: "AccountPayable", entityId: p.id });
  await syncPayroll(user.organizationId);
  refresh();
  return { ok: true };
}

export async function updateTaxSettingsAction(input: { taxRate: number; taxDueDay: number }): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!isDirector(user)) return { ok: false, error: "Só a diretoria altera o imposto." };
  const current = await getPricingSettings(user.organizationId);
  return updatePayrollSettingsAction({ captureFeeSolo: current.captureFeeSolo, captureFeeShared: current.captureFeeShared, taxRate: input.taxRate, taxDueDay: input.taxDueDay }).then(async (r) => {
    if (r.ok) {
      const { syncTaxes } = await import("@/lib/finance/taxes");
      await syncTaxes(user.organizationId);
      revalidatePath("/financeiro/impostos");
    }
    return r;
  });
}
