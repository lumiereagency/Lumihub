import "server-only";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AlertCategory, AlertSeverity } from "@/generated/prisma/enums";

interface DetectedAlert {
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Cada alerta é derivado de uma condição real no banco no momento da
// checagem — nunca um valor fixo ou simulado. Sem infraestrutura de cron
// (mesmo princípio da régua de cobrança da Fase 9), a detecção roda sob
// demanda: toda vez que a página de Alertas é carregada.
async function detectAlerts(organizationId: string): Promise<DetectedAlert[]> {
  const now = new Date();
  const detected: DetectedAlert[] = [];

  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { currency: true } });
  const currency = organization.currency;

  const overduePayables = await db.accountPayable.findMany({
    where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] }, dueDate: { lt: now } },
    select: { id: true, description: true, amount: true, dueDate: true },
  });
  for (const p of overduePayables) {
    detected.push({
      category: "FINANCEIRO",
      severity: "URGENTE",
      title: `Conta a pagar atrasada: ${p.description}`,
      message: `Vencida em ${formatDate(p.dueDate)}, valor ${formatCurrency(Number(p.amount), currency)}.`,
      relatedEntityType: "AccountPayable",
      relatedEntityId: p.id,
    });
  }

  const overdueReceivables = await db.accountReceivable.findMany({
    where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] }, dueDate: { lt: now } },
    select: { id: true, description: true, amount: true, dueDate: true },
  });
  for (const r of overdueReceivables) {
    detected.push({
      category: "FINANCEIRO",
      severity: "URGENTE",
      title: `Cobrança atrasada: ${r.description}`,
      message: `Vencida em ${formatDate(r.dueDate)}, valor ${formatCurrency(Number(r.amount), currency)}.`,
      relatedEntityType: "AccountReceivable",
      relatedEntityId: r.id,
    });
  }

  const openLeads = await db.lead.findMany({
    where: { organizationId, deletedAt: null, stage: { notIn: ["FECHADO", "PERDIDO"] } },
    select: { id: true, company: true, nextContactAt: true },
  });
  for (const lead of openLeads) {
    const overdue = !lead.nextContactAt || lead.nextContactAt.getTime() < now.getTime();
    if (overdue) {
      detected.push({
        category: "COMERCIAL",
        severity: "ATENCAO",
        title: `Lead sem follow-up em dia: ${lead.company}`,
        message: lead.nextContactAt
          ? `Próximo contato estava agendado para ${formatDate(lead.nextContactAt)} e já passou.`
          : "Nenhum próximo contato agendado.",
        relatedEntityType: "Lead",
        relatedEntityId: lead.id,
      });
    }
  }

  const lateProjects = await db.project.findMany({
    where: { organizationId, deletedAt: null, status: "ATRASADO" },
    select: { id: true, name: true, dueDate: true },
  });
  for (const proj of lateProjects) {
    detected.push({
      category: "OPERACAO",
      severity: "URGENTE",
      title: `Projeto atrasado: ${proj.name}`,
      message: proj.dueDate ? `Prazo era ${formatDate(proj.dueDate)}.` : "Projeto marcado como atrasado.",
      relatedEntityType: "Project",
      relatedEntityId: proj.id,
    });
  }

  const badClients = await db.client.findMany({
    where: { organizationId, deletedAt: null, status: "INADIMPLENTE" },
    select: { id: true, companyName: true },
  });
  for (const c of badClients) {
    detected.push({
      category: "CLIENTES",
      severity: "URGENTE",
      title: `Cliente inadimplente: ${c.companyName}`,
      message: "Cliente marcado como inadimplente no cadastro.",
      relatedEntityType: "Client",
      relatedEntityId: c.id,
    });
  }

  const expiringContracts = await db.contract.findMany({
    where: { organizationId, status: "ATIVO", endDate: { not: null, lt: new Date(now.getTime() + 30 * DAY_MS) } },
    select: { id: true, title: true, endDate: true },
  });
  for (const c of expiringContracts) {
    const expired = c.endDate!.getTime() < now.getTime();
    detected.push({
      category: "CONTRATOS",
      severity: expired ? "URGENTE" : "ATENCAO",
      title: expired ? `Contrato vencido: ${c.title}` : `Contrato vencendo em breve: ${c.title}`,
      message: `Término em ${formatDate(c.endDate!)}.`,
      relatedEntityType: "Contract",
      relatedEntityId: c.id,
    });
  }

  const soon = new Date(now.getTime() + 7 * DAY_MS);
  const understaffedProjects = await db.project.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: { notIn: ["CONCLUIDO"] },
      dueDate: { not: null, lte: soon, gte: now },
      team: { none: {} },
    },
    select: { id: true, name: true, dueDate: true },
  });
  for (const proj of understaffedProjects) {
    detected.push({
      category: "EQUIPE",
      severity: "ATENCAO",
      title: `Projeto sem equipe alocada: ${proj.name}`,
      message: `Prazo em ${formatDate(proj.dueDate!)} e nenhum membro de equipe atribuído ainda.`,
      relatedEntityType: "Project",
      relatedEntityId: proj.id,
    });
  }

  return detected;
}

// Cria um Alert para cada condição detectada que ainda não tem um alerta
// (de qualquer status) para a mesma entidade+categoria — evita duplicar a
// cada carregamento da página sem precisar de um agendador.
export async function syncAlerts(organizationId: string): Promise<void> {
  const detected = await detectAlerts(organizationId);
  if (detected.length === 0) return;

  const existing = await db.alert.findMany({
    where: { organizationId },
    select: { category: true, relatedEntityType: true, relatedEntityId: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.category}|${e.relatedEntityType}|${e.relatedEntityId}`));

  const toCreate = detected.filter((d) => !existingKeys.has(`${d.category}|${d.relatedEntityType}|${d.relatedEntityId}`));
  if (toCreate.length > 0) {
    await db.alert.createMany({ data: toCreate.map((d) => ({ organizationId, ...d })) });
  }
}
