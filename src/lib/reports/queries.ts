import "server-only";
import { db } from "@/lib/db";
import { INCOME_TYPES } from "@/lib/finance/queries";
import { LEAD_STAGE_LABELS } from "@/lib/validation/crm";

function toNumber(v: unknown): number {
  return v ? Number(v) : 0;
}

export interface FinancialReportRow {
  category: string;
  receita: number;
  despesa: number;
}

export async function getFinancialReport(organizationId: string): Promise<FinancialReportRow[]> {
  const movements = await db.financialMovement.findMany({
    where: { organizationId, status: "PAGO" },
    select: { type: true, amount: true, category: { select: { name: true } } },
  });

  const buckets = new Map<string, { receita: number; despesa: number }>();
  for (const m of movements) {
    const label = m.category?.name ?? "Sem categoria";
    if (!buckets.has(label)) buckets.set(label, { receita: 0, despesa: 0 });
    const bucket = buckets.get(label)!;
    const amount = toNumber(m.amount);
    if ((INCOME_TYPES as readonly string[]).includes(m.type)) bucket.receita += amount;
    else bucket.despesa += amount;
  }

  return [...buckets.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.receita + b.despesa - (a.receita + a.despesa));
}

export interface CommercialReportRow {
  stage: string;
  stageLabel: string;
  count: number;
  potentialValue: number;
}

export async function getCommercialReport(organizationId: string): Promise<CommercialReportRow[]> {
  const groups = await db.lead.groupBy({
    by: ["stage"],
    where: { organizationId, deletedAt: null },
    _count: true,
    _sum: { potentialValue: true },
  });

  return groups
    .map((g) => ({
      stage: g.stage,
      stageLabel: LEAD_STAGE_LABELS[g.stage],
      count: g._count,
      potentialValue: toNumber(g._sum.potentialValue),
    }))
    .sort((a, b) => b.potentialValue - a.potentialValue);
}

export interface ClientReportRow {
  clientId: string;
  companyName: string;
  status: string;
  contractCount: number;
  totalRevenue: number;
}

export async function getClientsReport(organizationId: string): Promise<ClientReportRow[]> {
  const clients = await db.client.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      companyName: true,
      status: true,
      contracts: { select: { id: true } },
      financialMovements: { where: { status: "PAGO" }, select: { type: true, amount: true } },
    },
  });

  return clients
    .map((c) => ({
      clientId: c.id,
      companyName: c.companyName,
      status: c.status,
      contractCount: c.contracts.length,
      totalRevenue: c.financialMovements
        .filter((m) => (INCOME_TYPES as readonly string[]).includes(m.type))
        .reduce((sum, m) => sum + toNumber(m.amount), 0),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export interface ProjectReportRow {
  projectId: string;
  name: string;
  clientName: string;
  status: string;
  value: number;
  costEstimate: number;
  teamCost: number;
  margin: number;
}

export async function getProjectsReport(organizationId: string): Promise<ProjectReportRow[]> {
  const projects = await db.project.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      value: true,
      costEstimate: true,
      client: { select: { companyName: true } },
      team: { select: { costAllocated: true } },
    },
  });

  return projects.map((p) => {
    const value = toNumber(p.value);
    const costEstimate = toNumber(p.costEstimate);
    const teamCost = p.team.reduce((sum, t) => sum + toNumber(t.costAllocated), 0);
    return {
      projectId: p.id,
      name: p.name,
      clientName: p.client.companyName,
      status: p.status,
      value,
      costEstimate,
      teamCost,
      margin: value - costEstimate - teamCost,
    };
  });
}

export interface TeamReportRow {
  teamMemberId: string;
  name: string;
  role: string;
  type: string;
  active: boolean;
  projectCount: number;
  totalCostAllocated: number;
}

export async function getTeamReport(organizationId: string): Promise<TeamReportRow[]> {
  const members = await db.teamMember.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      role: true,
      type: true,
      active: true,
      projects: { select: { costAllocated: true } },
    },
  });

  return members
    .map((m) => ({
      teamMemberId: m.id,
      name: m.name,
      role: m.role,
      type: m.type,
      active: m.active,
      projectCount: m.projects.length,
      totalCostAllocated: m.projects.reduce((sum, p) => sum + toNumber(p.costAllocated), 0),
    }))
    .sort((a, b) => b.totalCostAllocated - a.totalCostAllocated);
}
