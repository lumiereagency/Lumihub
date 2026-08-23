import "server-only";
import { db } from "@/lib/db";
import { INCOME_TYPES, EXPENSE_TYPES } from "@/lib/finance/queries";
import type { GoalType, GoalScenario } from "@/generated/prisma/enums";

function toNumber(v: unknown): number {
  return v ? Number(v) : 0;
}

async function computeAchieved(organizationId: string, type: GoalType, periodStart: Date, periodEnd: Date): Promise<number> {
  switch (type) {
    case "FATURAMENTO": {
      const agg = await db.financialMovement.aggregate({
        where: { organizationId, status: "PAGO", type: { in: [...INCOME_TYPES] }, paidAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      });
      return toNumber(agg._sum?.amount);
    }
    case "RECEBIMENTOS": {
      const agg = await db.accountReceivable.aggregate({
        where: { organizationId, status: "PAGO", paidAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      });
      return toNumber(agg._sum?.amount);
    }
    case "NOVOS_CLIENTES": {
      return db.client.count({ where: { organizationId, deletedAt: null, createdAt: { gte: periodStart, lte: periodEnd } } });
    }
    case "PROSPECCAO": {
      return db.lead.count({ where: { organizationId, deletedAt: null, createdAt: { gte: periodStart, lte: periodEnd } } });
    }
    case "PROJETOS": {
      return db.project.count({
        where: { organizationId, status: "CONCLUIDO", deletedAt: null, updatedAt: { gte: periodStart, lte: periodEnd } },
      });
    }
    case "MARGEM": {
      const movements = await db.financialMovement.findMany({
        where: { organizationId, status: "PAGO", paidAt: { gte: periodStart, lte: periodEnd } },
        select: { type: true, amount: true },
      });
      let receita = 0;
      let despesa = 0;
      for (const m of movements) {
        const amount = toNumber(m.amount);
        if ((INCOME_TYPES as readonly string[]).includes(m.type)) receita += amount;
        else if ((EXPENSE_TYPES as readonly string[]).includes(m.type)) despesa += amount;
      }
      return receita > 0 ? ((receita - despesa) / receita) * 100 : 0;
    }
    default:
      return 0;
  }
}

export interface GoalScenarioValue {
  goalId: string;
  scenario: GoalScenario;
  targetValue: number;
}

export interface GoalGroup {
  key: string;
  type: GoalType;
  periodStart: string;
  periodEnd: string;
  achieved: number;
  scenarios: GoalScenarioValue[];
}

export async function getGoalsWithProgress(organizationId: string): Promise<GoalGroup[]> {
  const goals = await db.goal.findMany({
    where: { organizationId },
    orderBy: [{ periodStart: "desc" }, { type: "asc" }],
  });

  const groups = new Map<string, GoalGroup>();
  for (const g of goals) {
    const key = `${g.type}|${g.periodStart.toISOString()}|${g.periodEnd.toISOString()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        type: g.type,
        periodStart: g.periodStart.toISOString(),
        periodEnd: g.periodEnd.toISOString(),
        achieved: 0,
        scenarios: [],
      });
    }
    groups.get(key)!.scenarios.push({ goalId: g.id, scenario: g.scenario, targetValue: toNumber(g.targetValue) });
  }

  await Promise.all(
    [...groups.values()].map(async (group) => {
      group.achieved = await computeAchieved(organizationId, group.type, new Date(group.periodStart), new Date(group.periodEnd));
    }),
  );

  return [...groups.values()];
}
