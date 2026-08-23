import "server-only";
import { addDays, addMonths, endOfDay } from "date-fns";
import { db } from "@/lib/db";
import { getFinanceOverview } from "@/lib/finance/queries";

interface CashEvent {
  date: Date;
  amount: number;
  kind: "RECEITA" | "DESPESA";
  description: string;
}

function toNumber(v: unknown): number {
  return v ? Number(v) : 0;
}

async function collectPendingEvents(organizationId: string): Promise<CashEvent[]> {
  const [receivables, payables, installments] = await Promise.all([
    db.accountReceivable.findMany({
      where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] } },
      select: { amount: true, dueDate: true, description: true },
    }),
    db.accountPayable.findMany({
      where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] } },
      select: { amount: true, dueDate: true, description: true },
    }),
    db.creditCardInstallment.findMany({
      where: { paid: false, transaction: { card: { organizationId } } },
      select: {
        amount: true,
        invoiceMonth: true,
        number: true,
        transaction: { select: { description: true, installmentsTotal: true, card: { select: { dueDay: true, name: true } } } },
      },
    }),
  ]);

  const events: CashEvent[] = [];

  for (const r of receivables) {
    events.push({ date: r.dueDate, amount: toNumber(r.amount), kind: "RECEITA", description: r.description });
  }
  for (const p of payables) {
    events.push({ date: p.dueDate, amount: -toNumber(p.amount), kind: "DESPESA", description: p.description });
  }
  for (const i of installments) {
    const dueDate = new Date(i.invoiceMonth.getFullYear(), i.invoiceMonth.getMonth(), i.transaction.card.dueDay);
    const label =
      i.transaction.installmentsTotal > 1
        ? `${i.transaction.description} (${i.number}/${i.transaction.installmentsTotal}) — ${i.transaction.card.name}`
        : `${i.transaction.description} — ${i.transaction.card.name}`;
    events.push({ date: dueDate, amount: -toNumber(i.amount), kind: "DESPESA", description: label });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function balanceAt(startBalance: number, events: CashEvent[], cutoff: Date): number {
  return events.filter((e) => e.date <= cutoff).reduce((sum, e) => sum + e.amount, startBalance);
}

export async function getCashFlowProjection(organizationId: string) {
  const now = new Date();
  const [overview, events] = await Promise.all([getFinanceOverview(organizationId), collectPendingEvents(organizationId)]);

  const startBalance = overview.kpis.saldoAtual;

  const horizons = [
    { key: "d7", label: "7 dias", date: endOfDay(addDays(now, 7)) },
    { key: "d30", label: "30 dias", date: endOfDay(addDays(now, 30)) },
    { key: "d90", label: "90 dias", date: endOfDay(addDays(now, 90)) },
    { key: "m6", label: "6 meses", date: endOfDay(addMonths(now, 6)) },
    { key: "m12", label: "12 meses", date: endOfDay(addMonths(now, 12)) },
  ].map((h) => ({ ...h, projectedBalance: balanceAt(startBalance, events, h.date) }));

  const monthlySeries = Array.from({ length: 13 }, (_, i) => {
    const cutoff = endOfDay(addMonths(now, i));
    return {
      month: i,
      label: i === 0 ? "Hoje" : `+${i}m`,
      balance: balanceAt(startBalance, events, cutoff),
    };
  });

  const upcoming90 = events
    .filter((e) => e.date >= now && e.date <= addDays(now, 90))
    .slice(0, 12);

  return {
    startBalance,
    pontoEquilibrio: overview.indicators.pontoEquilibrio,
    reservaAtual: overview.indicators.reservaAtual,
    horizons,
    monthlySeries,
    upcoming: upcoming90,
    hasPendingData: events.length > 0,
  };
}
