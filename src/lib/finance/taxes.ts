import "server-only";
import { db } from "@/lib/db";
import { noonOf } from "@/lib/billing/dates";
import { competenceLabel, competenceOf, shiftCompetence, FOLHA } from "@/lib/payroll/folha";

// IMPOSTO (Simples Nacional, ME): % sobre tudo o que é RECEBIDO no mês.
// A base guarda a reserva como conta a pagar ("DAS") com vencimento no dia
// configurado do mês seguinte, e recalcula sozinha enquanto não for paga.

export const IMPOSTO = "IMPOSTO";
const TAX_CATEGORY = "Impostos";

export function monthRange(comp: string) {
  const [y, m] = comp.split("-").map(Number);
  const next = shiftCompetence(comp, 1);
  return { start: new Date(`${comp}-01T00:00:00-03:00`), end: new Date(`${next}-01T00:00:00-03:00`), y, m };
}

export async function receivedIn(organizationId: string, comp: string): Promise<number> {
  const { start, end } = monthRange(comp);
  const agg = await db.financialMovement.aggregate({
    where: { organizationId, type: "RECEITA", status: "PAGO", paidAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

async function taxSettings(organizationId: string) {
  const s = await db.pricingSettings.findUnique({ where: { organizationId }, select: { taxRate: true, taxDueDay: true } });
  return { rate: Number(s?.taxRate ?? 6), dueDay: s?.taxDueDay ?? 20 };
}

async function taxCategory(organizationId: string) {
  const found = await db.financialCategory.findFirst({ where: { organizationId, name: TAX_CATEGORY, type: "DESPESA" } });
  return found?.id ?? (await db.financialCategory.create({ data: { organizationId, name: TAX_CATEGORY, type: "DESPESA" } })).id;
}

export async function syncTaxes(organizationId: string) {
  const { rate, dueDay } = await taxSettings(organizationId);
  const current = competenceOf(new Date());
  for (const comp of [shiftCompetence(current, -1), current]) {
    const received = await receivedIn(organizationId, comp);
    const amount = Math.round(received * rate) / 100;
    const existing = await db.accountPayable.findFirst({ where: { organizationId, kind: IMPOSTO, competence: comp, status: { not: "CANCELADO" } } });
    if (existing?.status === "PAGO") continue;
    const next = shiftCompetence(comp, 1);
    const dueDate = noonOf(`${next}-${String(Math.min(dueDay, 28)).padStart(2, "0")}`);
    const description = `DAS Simples Nacional — ${competenceLabel(comp)} (${rate}% de ${received.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`;
    if (amount <= 0) {
      if (existing) {
        await db.accountPayable.delete({ where: { id: existing.id } });
        if (existing.movementId) await db.financialMovement.delete({ where: { id: existing.movementId } }).catch(() => {});
      }
      continue;
    }
    if (existing) {
      await db.accountPayable.update({ where: { id: existing.id }, data: { amount, dueDate, description } });
      if (existing.movementId) await db.financialMovement.update({ where: { id: existing.movementId }, data: { amount, dueDate } }).catch(() => {});
    } else {
      const categoryId = await taxCategory(organizationId);
      const movement = await db.financialMovement.create({
        data: { organizationId, type: "DESPESA", amount, competenceDate: noonOf(`${comp}-15`), dueDate, categoryId, status: "PENDENTE", notes: "Reserva automática do Simples Nacional." },
      });
      await db.accountPayable.create({
        data: { organizationId, movementId: movement.id, kind: IMPOSTO, competence: comp, description, supplier: "Receita Federal (DAS)", categoryId, amount, dueDate, status: "PENDENTE" },
      });
    }
  }
}

export async function syncAllTaxes() {
  const orgs = await db.organization.findMany({ select: { id: true } });
  for (const o of orgs) await syncTaxes(o.id);
}

// "Quanto sobra de verdade" no mês: recebido − imposto − custos − equipe.
export interface MonthResult {
  competence: string;
  label: string;
  received: number;
  expectedIncome: number; // recebido + o que ainda vence no mês
  taxRate: number;
  taxes: number;
  costs: number;
  team: number;
  profit: number;
  margin: number | null;
}

export async function getMonthResult(organizationId: string, comp: string): Promise<MonthResult> {
  const { start, end } = monthRange(comp);
  const { rate } = await taxSettings(organizationId);
  const [received, pendingIncome, costs, team] = await Promise.all([
    receivedIn(organizationId, comp),
    db.accountReceivable.aggregate({ where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] }, dueDate: { gte: start, lt: end } }, _sum: { amount: true } }),
    // Custos do mês: contas com vencimento no mês, fora folha e imposto (que entram separados).
    db.accountPayable.aggregate({
      where: { organizationId, status: { not: "CANCELADO" }, dueDate: { gte: start, lt: end }, OR: [{ kind: null }, { kind: { notIn: [FOLHA, IMPOSTO] } }] },
      _sum: { amount: true },
    }),
    db.accountPayable.aggregate({ where: { organizationId, kind: FOLHA, competence: comp, status: { not: "CANCELADO" } }, _sum: { amount: true } }),
  ]);
  const taxes = Math.round(received * rate) / 100;
  const c = Number(costs._sum.amount ?? 0);
  const t = Number(team._sum.amount ?? 0);
  const profit = Math.round((received - taxes - c - t) * 100) / 100;
  return {
    competence: comp,
    label: competenceLabel(comp),
    received,
    expectedIncome: received + Number(pendingIncome._sum.amount ?? 0),
    taxRate: rate,
    taxes,
    costs: c,
    team: t,
    profit,
    margin: received > 0 ? Math.round((profit / received) * 1000) / 10 : null,
  };
}
