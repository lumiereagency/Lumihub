"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDirector } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { formatCurrency } from "@/lib/format";
import { notifyUsers } from "@/lib/notifications/notify";

type Result = { ok: true; count?: number } | { ok: false; error: string };

function done(proposalId?: string) {
  revalidatePath("/comissoes");
  revalidatePath("/dashboard");
  if (proposalId) revalidatePath(`/propostas/${proposalId}`);
}

async function notifySeller(organizationId: string, sellerUserId: string | null, title: string, body: string) {
  if (!sellerUserId) return;
  await notifyUsers({ organizationId, userIds: [sellerUserId], title, body, link: "/comissoes", category: "comercial" });
}

async function load(id: string, organizationId: string) {
  return db.commission.findFirst({ where: { id, organizationId }, include: { proposal: { select: { title: true } } } });
}

// Cliente pagou (ou pagou o sinal/a quitação, nos eventos): a comissão fica disponível para pagar.
export async function releaseCommissionAction(id: string): Promise<Result> {
  const user = await requireDirector();
  const c = await load(id, user.organizationId);
  if (!c) return { ok: false, error: "Comissão não encontrada." };
  if (c.status !== "AGUARDANDO_CLIENTE") return { ok: false, error: "Esta comissão já foi liberada." };
  await db.commission.update({ where: { id }, data: { status: "A_PAGAR", releasedAt: new Date() } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "COMMISSION_RELEASED", entityType: "Commission", entityId: id });
  await notifySeller(user.organizationId, c.sellerUserId, "Comissão liberada 💰", `${formatCurrency(Number(c.amount))} de "${c.proposal.title}" — o cliente pagou.`);
  done(c.proposalId);
  return { ok: true };
}

export async function payCommissionAction(id: string): Promise<Result> {
  const user = await requireDirector();
  const c = await load(id, user.organizationId);
  if (!c) return { ok: false, error: "Comissão não encontrada." };
  if (c.status === "PAGA") return { ok: false, error: "Esta comissão já está paga." };
  if (c.status === "CANCELADA") return { ok: false, error: "Comissão estornada não pode ser paga. Reabra antes." };
  const now = new Date();
  await db.commission.update({ where: { id }, data: { status: "PAGA", paidAt: now, paidByUserId: user.id, releasedAt: c.releasedAt ?? now } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "COMMISSION_PAID", entityType: "Commission", entityId: id, metadata: { amount: Number(c.amount) } });
  await notifySeller(user.organizationId, c.sellerUserId, "Comissão paga ✅", `${formatCurrency(Number(c.amount))} de "${c.proposal.title}".`);
  done(c.proposalId);
  return { ok: true };
}

// Fecha o repasse do vendedor: paga de uma vez tudo o que está "a pagar".
export async function payAllForSellerAction(sellerUserId: string): Promise<Result> {
  const user = await requireDirector();
  const pending = await db.commission.findMany({ where: { organizationId: user.organizationId, sellerUserId, status: "A_PAGAR" } });
  if (!pending.length) return { ok: false, error: "Nada a pagar para esta pessoa agora." };
  const now = new Date();
  await db.commission.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: "PAGA", paidAt: now, paidByUserId: user.id } });
  const total = pending.reduce((s, p) => s + Number(p.amount), 0);
  await audit({ organizationId: user.organizationId, userId: user.id, action: "COMMISSION_PAID_BATCH", entityType: "Commission", metadata: { sellerUserId, count: pending.length, total } });
  await notifySeller(user.organizationId, sellerUserId, "Comissões pagas ✅", `${pending.length} comiss${pending.length === 1 ? "ão" : "ões"} somando ${formatCurrency(total)}.`);
  done();
  return { ok: true, count: pending.length };
}

// Estorno (ex: cliente cancelou ou não pagou a 2ª mensalidade).
export async function cancelCommissionAction(id: string, reason: string): Promise<Result> {
  const user = await requireDirector();
  const c = await load(id, user.organizationId);
  if (!c) return { ok: false, error: "Comissão não encontrada." };
  if (c.status === "CANCELADA") return { ok: false, error: "Esta comissão já foi estornada." };
  await db.commission.update({ where: { id }, data: { status: "CANCELADA", cancelReason: reason.trim().slice(0, 300) || null } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "COMMISSION_CANCELLED", entityType: "Commission", entityId: id, metadata: { reason, wasPaid: c.status === "PAGA" } });
  await notifySeller(user.organizationId, c.sellerUserId, "Comissão estornada", `"${c.proposal.title}"${reason.trim() ? `: ${reason.trim()}` : "."}`);
  done(c.proposalId);
  return { ok: true };
}

// Desfaz o último passo (clique errado).
export async function undoCommissionAction(id: string): Promise<Result> {
  const user = await requireDirector();
  const c = await load(id, user.organizationId);
  if (!c) return { ok: false, error: "Comissão não encontrada." };
  const data =
    c.status === "PAGA"
      ? { status: "A_PAGAR" as const, paidAt: null, paidByUserId: null }
      : c.status === "A_PAGAR"
        ? { status: "AGUARDANDO_CLIENTE" as const, releasedAt: null }
        : c.status === "CANCELADA"
          ? { status: (c.paidAt ? "PAGA" : c.releasedAt ? "A_PAGAR" : "AGUARDANDO_CLIENTE") as "PAGA" | "A_PAGAR" | "AGUARDANDO_CLIENTE", cancelReason: null }
          : null;
  if (!data) return { ok: false, error: "Não há o que desfazer." };
  await db.commission.update({ where: { id }, data });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "COMMISSION_UNDO", entityType: "Commission", entityId: id, metadata: { from: c.status, to: data.status } });
  done(c.proposalId);
  return { ok: true };
}
