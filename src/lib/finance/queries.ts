import "server-only";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { db } from "@/lib/db";

export const INCOME_TYPES = ["RECEITA", "RECEBIMENTO"] as const;
export const EXPENSE_TYPES = [
  "DESPESA",
  "PAGAMENTO",
  "SALARIO",
  "COMISSAO",
  "CUSTO_PROJETO",
  "PARCELA",
  "INVESTIMENTO",
] as const;

function toNumber(v: unknown): number {
  return v ? Number(v) : 0;
}

export async function getFinanceOverview(organizationId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [paidMovements, receivableAgg, receivableOverdueAgg, payableAgg, payableOverdueAgg, payableNext30Agg] =
    await Promise.all([
      db.financialMovement.findMany({
        where: { organizationId, status: "PAGO" },
        select: { type: true, amount: true, paidAt: true, competenceDate: true, clientId: true, categoryId: true },
        orderBy: { paidAt: "desc" },
        take: 2000,
      }),
      db.accountReceivable.aggregate({
        where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] } },
        _sum: { amount: true },
      }),
      db.accountReceivable.aggregate({
        where: { organizationId, status: "ATRASADO" },
        _sum: { amount: true },
      }),
      db.accountPayable.aggregate({
        where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] } },
        _sum: { amount: true },
      }),
      db.accountPayable.aggregate({
        where: { organizationId, status: "ATRASADO" },
        _sum: { amount: true },
      }),
      db.accountPayable.aggregate({
        where: { organizationId, status: "PENDENTE", dueDate: { gte: now, lte: in30 } },
        _sum: { amount: true },
      }),
    ]);

  const isIncome = (t: string) => (INCOME_TYPES as readonly string[]).includes(t);
  const isExpense = (t: string) => (EXPENSE_TYPES as readonly string[]).includes(t);

  let totalReceita = 0;
  let totalDespesa = 0;
  let receitaMes = 0;
  let despesaMes = 0;
  const monthsWithMovement = new Set<string>();
  const clientTotals = new Map<string, number>();
  const categoryTotals = new Map<string, number>();
  const monthlyTrend = new Map<string, { receita: number; despesa: number }>();

  for (const m of paidMovements) {
    const amount = toNumber(m.amount);
    const paidAt = m.paidAt ?? m.competenceDate;
    const monthKey = format(paidAt, "yyyy-MM");
    monthsWithMovement.add(monthKey);

    if (isIncome(m.type)) {
      totalReceita += amount;
      if (paidAt >= monthStart && paidAt <= monthEnd) receitaMes += amount;
      if (m.clientId) clientTotals.set(m.clientId, (clientTotals.get(m.clientId) ?? 0) + amount);
    } else if (isExpense(m.type)) {
      totalDespesa += amount;
      if (paidAt >= monthStart && paidAt <= monthEnd) despesaMes += amount;
      if (m.categoryId) categoryTotals.set(m.categoryId, (categoryTotals.get(m.categoryId) ?? 0) + amount);
    }

    if (!monthlyTrend.has(monthKey)) monthlyTrend.set(monthKey, { receita: 0, despesa: 0 });
    const bucket = monthlyTrend.get(monthKey)!;
    if (isIncome(m.type)) bucket.receita += amount;
    if (isExpense(m.type)) bucket.despesa += amount;
  }

  const monthCount = Math.max(monthsWithMovement.size, 1);
  const mediaReceitaMensal = totalReceita / monthCount;
  const mediaDespesaMensal = totalDespesa / monthCount;
  const margem = totalReceita > 0 ? ((totalReceita - totalDespesa) / totalReceita) * 100 : 0;
  const burnRate = Math.max(0, mediaDespesaMensal - mediaReceitaMensal);
  const pontoEquilibrio = mediaDespesaMensal;

  const saldoAtual = totalReceita - totalDespesa;
  const mesesCobertura = burnRate > 0 ? saldoAtual / burnRate : null;

  const last6Months: { month: string; label: string; receita: number; despesa: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i);
    const key = format(d, "yyyy-MM");
    const bucket = monthlyTrend.get(key) ?? { receita: 0, despesa: 0 };
    last6Months.push({ month: key, label: format(d, "MMM"), receita: bucket.receita, despesa: bucket.despesa });
  }

  const [clients, categories] = await Promise.all([
    db.client.findMany({ where: { id: { in: [...clientTotals.keys()] } }, select: { id: true, companyName: true } }),
    db.financialCategory.findMany({ where: { id: { in: [...categoryTotals.keys()] } }, select: { id: true, name: true } }),
  ]);
  const clientNameMap = new Map(clients.map((c) => [c.id, c.companyName]));
  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

  const receitaPorCliente = [...clientTotals.entries()]
    .map(([id, value]) => ({ label: clientNameMap.get(id) ?? "Cliente removido", value }))
    .sort((a, b) => b.value - a.value);

  const despesaPorCategoria = [...categoryTotals.entries()]
    .map(([id, value]) => ({ label: categoryNameMap.get(id) ?? "Sem categoria", value }))
    .sort((a, b) => b.value - a.value);

  return {
    kpis: {
      saldoAtual,
      receitaMes,
      despesaMes,
      lucroEstimado: receitaMes - despesaMes,
      aReceber: toNumber(receivableAgg._sum.amount),
      aPagar: toNumber(payableAgg._sum.amount),
      atrasados: toNumber(receivableOverdueAgg._sum.amount) + toNumber(payableOverdueAgg._sum.amount),
      compromissosFuturos: toNumber(payableNext30Agg._sum.amount),
    },
    indicators: {
      margem,
      pontoEquilibrio,
      burnRate,
      reservaAtual: saldoAtual,
      mesesCobertura,
    },
    charts: {
      receitaDespesaMensal: last6Months,
      despesaPorCategoria,
      receitaPorCliente,
    },
  };
}
