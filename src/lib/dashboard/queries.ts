import "server-only";
import { db } from "@/lib/db";

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toNumber(value: unknown): number {
  return value ? Number(value) : 0;
}

export async function getFinancialSummary(organizationId: string) {
  const now = new Date();
  const in30 = addDays(now, 30);

  const [receivedAgg, paidAgg, receivablePending, payablePending, receivableNext30, payableNext30] =
    await Promise.all([
      db.accountReceivable.aggregate({
        where: { organizationId, status: "PAGO" },
        _sum: { amount: true },
      }),
      db.accountPayable.aggregate({
        where: { organizationId, status: "PAGO" },
        _sum: { amount: true },
      }),
      db.accountReceivable.aggregate({
        where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] } },
        _sum: { amount: true },
      }),
      db.accountPayable.aggregate({
        where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] } },
        _sum: { amount: true },
      }),
      db.accountReceivable.aggregate({
        where: {
          organizationId,
          status: { in: ["PENDENTE", "ATRASADO"] },
          dueDate: { gte: now, lte: in30 },
        },
        _sum: { amount: true },
      }),
      db.accountPayable.aggregate({
        where: {
          organizationId,
          status: { in: ["PENDENTE", "ATRASADO"] },
          dueDate: { gte: now, lte: in30 },
        },
        _sum: { amount: true },
      }),
    ]);

  const saldoAtual = toNumber(receivedAgg._sum.amount) - toNumber(paidAgg._sum.amount);
  const aReceber = toNumber(receivablePending._sum.amount);
  const aPagar = toNumber(payablePending._sum.amount);
  const receitaPrevista30 = toNumber(receivableNext30._sum.amount);
  const despesaPrevista30 = toNumber(payableNext30._sum.amount);

  return {
    saldoAtual,
    aReceber,
    aPagar,
    receitaPrevista30,
    despesaPrevista30,
    resultadoProjetado30: receitaPrevista30 - despesaPrevista30,
  };
}

export async function getCommercialSummary(organizationId: string) {
  const openLeads = await db.lead.findMany({
    where: { organizationId, deletedAt: null, stage: { notIn: ["FECHADO", "PERDIDO"] } },
    select: { potentialValue: true, probability: true },
  });

  const pipelineTotal = openLeads.reduce((sum, l) => sum + toNumber(l.potentialValue), 0);
  const pipelineWeighted = openLeads.reduce(
    (sum, l) => sum + (toNumber(l.potentialValue) * l.probability) / 100,
    0,
  );

  return { pipelineTotal, pipelineWeighted, openLeadsCount: openLeads.length };
}

export async function getActiveProjectsCount(organizationId: string) {
  return db.project.count({
    where: { organizationId, deletedAt: null, status: { notIn: ["CONCLUIDO"] } },
  });
}

export async function getUpcomingCommitments(organizationId: string) {
  const now = new Date();
  const in14 = addDays(now, 14);

  const [events, receivables, payables, contracts] = await Promise.all([
    db.calendarEvent.findMany({
      where: { organizationId, startAt: { gte: now, lte: in14 } },
      orderBy: { startAt: "asc" },
      take: 5,
      include: { client: { select: { companyName: true } } },
    }),
    db.accountReceivable.findMany({
      where: { organizationId, status: { in: ["PENDENTE"] }, dueDate: { gte: now, lte: in14 } },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { client: { select: { companyName: true } } },
    }),
    db.accountPayable.findMany({
      where: { organizationId, status: { in: ["PENDENTE"] }, dueDate: { gte: now, lte: in14 } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    db.contract.findMany({
      where: { organizationId, status: "ATIVO", deletedAt: null, endDate: { gte: now, lte: in14 } },
      orderBy: { endDate: "asc" },
      take: 5,
      include: { client: { select: { id: true, companyName: true } } },
    }),
  ]);

  return { events, receivables, payables, contracts };
}

export async function getAttentionItems(organizationId: string) {
  const now = new Date();
  const in30 = addDays(now, 30);

  const [overdueReceivables, overdueProjects, expiringContracts] = await Promise.all([
    db.accountReceivable.findMany({
      where: {
        organizationId,
        OR: [{ status: "ATRASADO" }, { status: "PENDENTE", dueDate: { lt: now } }],
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: { client: { select: { id: true, companyName: true } } },
    }),
    db.project.findMany({
      where: {
        organizationId,
        deletedAt: null,
        dueDate: { lt: now },
        status: { notIn: ["CONCLUIDO"] },
      },
      take: 10,
      include: { client: { select: { id: true, companyName: true } } },
    }),
    db.contract.findMany({
      where: { organizationId, status: "ATIVO", deletedAt: null, endDate: { gte: now, lte: in30 } },
      take: 10,
      include: { client: { select: { id: true, companyName: true } } },
    }),
  ]);

  return { overdueReceivables, overdueProjects, expiringContracts };
}

export async function getHealthScore(organizationId: string) {
  const [finance, commercial, attention, projects] = await Promise.all([
    getFinancialSummary(organizationId),
    getCommercialSummary(organizationId),
    getAttentionItems(organizationId),
    getActiveProjectsCount(organizationId),
  ]);

  function clamp(v: number) {
    return Math.max(0, Math.min(100, Math.round(v)));
  }

  const financeScore = clamp(
    100 - overdueRatioPenalty(finance.aReceber, attention.overdueReceivables.length),
  );
  const commercialScore = commercial.openLeadsCount === 0 ? 60 : clamp(60 + commercial.openLeadsCount * 2);
  const operationScore = clamp(100 - attention.overdueProjects.length * 15);
  const clientsScore = clamp(100 - attention.overdueReceivables.length * 10);
  const teamScore = 80;
  const cashScore = finance.resultadoProjetado30 >= 0 ? 85 : clamp(50 + finance.resultadoProjetado30 / 100);

  const overall = clamp(
    (financeScore + commercialScore + operationScore + clientsScore + teamScore + cashScore) / 6,
  );

  return {
    overall,
    breakdown: {
      financeiro: financeScore,
      comercial: commercialScore,
      operacao: operationScore,
      clientes: clientsScore,
      equipe: teamScore,
      caixaFuturo: cashScore,
    },
    projectsActive: projects,
  };
}

function overdueRatioPenalty(aReceber: number, overdueCount: number): number {
  if (aReceber === 0) return overdueCount === 0 ? 0 : 20;
  return Math.min(60, overdueCount * 12);
}
