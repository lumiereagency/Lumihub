import "server-only";
import { db } from "@/lib/db";
import { describePayRule, parsePayDayMode } from "@/lib/payroll/business-days";
import { FOLHA, competenceLabel, folhaDueDate, type FolhaBreakdown } from "@/lib/payroll/folha";

// Visão da folha de um mês: um cartão por pessoa com fixo, comissões e
// cachês, total, data e situação do pagamento.

export interface PersonMonth {
  memberId: string;
  userId: string | null;
  name: string;
  role: string;
  payRule: string;
  fixed: number;
  commissions: { description: string; amount: number }[];
  extras: { date: string; client: string; role: string; amount: number }[];
  commissionsTotal: number;
  extrasTotal: number;
  total: number;
  dueDate: string;
  status: "PENDENTE" | "PAGO" | "ATRASADO" | "SEM_VALOR";
  payableId: string | null;
  paidAt: string | null;
}

export interface MonthOverview {
  competence: string;
  label: string;
  people: PersonMonth[];
  totals: { fixed: number; commissions: number; extras: number; total: number; paid: number; open: number };
  nextDue: string | null;
}

function emptyBreakdown(): FolhaBreakdown {
  return { fixed: 0, commissions: [], extras: [] };
}

export async function getMonthOverview(organizationId: string, competence: string, onlyUserId?: string): Promise<MonthOverview> {
  const [members, folhas] = await Promise.all([
    db.teamMember.findMany({ where: { organizationId, ...(onlyUserId ? { userId: onlyUserId } : {}) }, orderBy: { name: "asc" } }),
    db.accountPayable.findMany({ where: { organizationId, kind: FOLHA, competence, status: { not: "CANCELADO" }, ...(onlyUserId ? { teamMember: { userId: onlyUserId } } : {}) } }),
  ]);
  const byMember = new Map(folhas.map((f) => [f.teamMemberId, f]));

  const people: PersonMonth[] = [];
  for (const m of members) {
    const f = byMember.get(m.id);
    if (!f && !m.active) continue;
    const b = (f?.breakdown as FolhaBreakdown | null) ?? emptyBreakdown();
    const fixed = f ? b.fixed : 0;
    const commissionsTotal = b.commissions.reduce((s, c) => s + c.amount, 0);
    const extrasTotal = b.extras.reduce((s, e) => s + e.amount, 0);
    const total = f ? Number(f.amount) : 0;
    const overdue = f && f.status !== "PAGO" && f.dueDate < new Date();
    people.push({
      memberId: m.id,
      userId: m.userId,
      name: m.name,
      role: m.role,
      payRule: describePayRule(parsePayDayMode(m.paymentDayMode), m.paymentDay),
      fixed,
      commissions: b.commissions.map((c) => ({ description: c.description, amount: c.amount })),
      extras: b.extras.map((e) => ({ date: e.date, client: e.client, role: e.role, amount: e.amount })),
      commissionsTotal,
      extrasTotal,
      total,
      dueDate: (f?.dueDate ?? folhaDueDate(m, competence)).toISOString(),
      status: !f ? "SEM_VALOR" : f.status === "PAGO" ? "PAGO" : overdue ? "ATRASADO" : "PENDENTE",
      payableId: f?.id ?? null,
      paidAt: f?.paidAt?.toISOString() ?? null,
    });
  }
  people.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const sum = (fn: (p: PersonMonth) => number) => Math.round(people.reduce((s, p) => s + fn(p), 0) * 100) / 100;
  const open = people.filter((p) => p.status === "PENDENTE" || p.status === "ATRASADO");
  return {
    competence,
    label: competenceLabel(competence),
    people,
    totals: {
      fixed: sum((p) => p.fixed),
      commissions: sum((p) => p.commissionsTotal),
      extras: sum((p) => p.extrasTotal),
      total: sum((p) => p.total),
      paid: sum((p) => (p.status === "PAGO" ? p.total : 0)),
      open: sum((p) => (p.status === "PENDENTE" || p.status === "ATRASADO" ? p.total : 0)),
    },
    nextDue: open.map((p) => p.dueDate).sort()[0] ?? null,
  };
}
