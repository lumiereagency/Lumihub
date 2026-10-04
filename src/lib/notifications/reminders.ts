import "server-only";
import { db } from "@/lib/db";
import { syncAlerts } from "@/lib/alerts/rules";
import { formatCurrency } from "@/lib/format";
import { notifyUsers } from "@/lib/notifications/notify";
import { brasiliaHour, parseNotificationSettings, type NotificationCategory } from "@/lib/notifications/settings";

// Rotina de pendências, chamada pelo crontab a cada 15 minutos. Cada aviso
// tem uma chave única (dedupeKey), então rodar de novo nunca repete aviso.
//   • alertas urgentes novos → quem acompanha alertas
//   • captação em até 1 hora e compromisso da agenda em até 30 min → quem está escalado
//   • resumo da manhã (8h–11h de Brasília, uma vez por dia) → cada pessoa da equipe

// Brasil sem horário de verão: Brasília é sempre UTC−3.
function brasiliaDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}
function dayBounds(day: string) {
  return { start: new Date(`${day}T00:00:00-03:00`), end: new Date(`${day}T23:59:59.999-03:00`) };
}
function hhmm(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

interface TeamUser {
  id: string;
  name: string;
  organizationId: string;
  director: boolean;
  permissions: Set<string>;
  wants: (c: NotificationCategory) => boolean;
}

async function loadTeam(organizationId: string): Promise<TeamUser[]> {
  const users = await db.user.findMany({
    where: { organizationId, isActive: true, deletedAt: null },
    select: { id: true, name: true, organizationId: true, isOwner: true, notificationSettings: true, role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    organizationId: u.organizationId,
    director: u.isOwner || u.role.key === "ADMIN",
    permissions: new Set(u.role.permissions.map((p) => p.permission.key)),
    wants: ((disabled) => (c: NotificationCategory) => !disabled.includes(c))(parseNotificationSettings(u.notificationSettings).disabled),
  }));
}

async function urgentAlerts(organizationId: string, team: TeamUser[], now: Date) {
  await syncAlerts(organizationId);
  const alerts = await db.alert.findMany({
    where: { organizationId, status: "ABERTO", severity: "URGENTE", createdAt: { gte: new Date(now.getTime() - 2 * 3600_000) } },
    select: { id: true, title: true, message: true },
  });
  const recipients = team.filter((u) => u.director || u.permissions.has("ALERTS_VIEW")).map((u) => u.id);
  for (const a of alerts) {
    await notifyUsers({ organizationId, userIds: recipients, title: a.title, body: a.message, link: "/alertas", category: "alertas", dedupeKey: `alert:${a.id}` });
  }
}

async function upcoming(organizationId: string, now: Date) {
  const captures = await db.capture.findMany({
    where: { organizationId, date: { gt: now, lte: new Date(now.getTime() + 65 * 60_000) }, status: { in: ["PLANEJADA", "CONFIRMADA"] } },
    select: { id: true, date: true, location: true, client: { select: { companyName: true } }, assignments: { where: { status: { not: "RECUSADO" } }, select: { userId: true } } },
  });
  for (const c of captures) {
    await notifyUsers({
      organizationId,
      userIds: c.assignments.map((a) => a.userId),
      title: `Captação às ${hhmm(c.date)}`,
      body: `${c.client.companyName}${c.location ? ` — ${c.location}` : ""}. Começa em menos de 1 hora.`,
      link: "/captacoes",
      category: "operacao",
      dedupeKey: `capture-soon:${c.id}:${c.date.toISOString()}`,
    });
  }

  const events = await db.calendarEvent.findMany({
    where: { organizationId, allDay: false, responsibleUserId: { not: null }, startAt: { gt: now, lte: new Date(now.getTime() + 30 * 60_000) } },
    select: { id: true, title: true, startAt: true, responsibleUserId: true },
  });
  for (const e of events) {
    await notifyUsers({
      organizationId,
      userIds: [e.responsibleUserId],
      title: `Às ${hhmm(e.startAt)}: ${e.title}`,
      body: "Seu compromisso começa em menos de 30 minutos.",
      link: "/agenda",
      category: "operacao",
      dedupeKey: `event-soon:${e.id}:${e.startAt.toISOString()}`,
    });
  }
}

async function morningDigest(organizationId: string, team: TeamUser[], now: Date) {
  const day = brasiliaDay(now);
  const { start, end } = dayBounds(day);
  const openTask = { status: { not: "CONCLUIDA" as const }, archivedAt: null, dueDate: { lte: end } };

  const [payToday, payLate, recLate, alertsUrgent, commissionsToPay] = await Promise.all([
    db.accountPayable.count({ where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] }, dueDate: { gte: start, lte: end } } }),
    db.accountPayable.count({ where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] }, dueDate: { lt: start } } }),
    db.accountReceivable.count({ where: { organizationId, status: { in: ["PENDENTE", "ATRASADO"] }, dueDate: { lt: start } } }),
    db.alert.count({ where: { organizationId, status: "ABERTO", severity: "URGENTE" } }),
    db.commission.aggregate({ where: { organizationId, status: "A_PAGAR" }, _count: true, _sum: { amount: true } }),
  ]);

  for (const u of team) {
    // Quem só usa o portal do Mídia ADESF não recebe o resumo da base.
    if (!u.permissions.has("DASHBOARD_VIEW") || !u.wants("resumo")) continue;
    const [tasks, followUps, captures] = await Promise.all([
      db.task.findMany({ where: { organizationId, ...openTask, OR: [{ assigneeUserId: u.id }, { members: { some: { userId: u.id } } }] }, select: { dueDate: true } }),
      db.lead.count({ where: { organizationId, ownerUserId: u.id, stage: { notIn: ["FECHADO", "PERDIDO"] }, nextContactAt: { lte: end } } }),
      db.captureAssignment.count({ where: { userId: u.id, status: { not: "RECUSADO" }, capture: { organizationId, date: { gte: start, lte: end } } } }),
    ]);
    const lateTasks = tasks.filter((t) => t.dueDate && t.dueDate < start).length;

    const parts: string[] = [];
    if (u.wants("tarefas")) {
      const todayTasks = tasks.length - lateTasks;
      if (todayTasks && lateTasks) parts.push(`${plural(todayTasks, "tarefa", "tarefas")} para hoje e ${plural(lateTasks, "atrasada", "atrasadas")}`);
      else if (todayTasks) parts.push(`${plural(todayTasks, "tarefa", "tarefas")} para hoje`);
      else if (lateTasks) parts.push(plural(lateTasks, "tarefa atrasada", "tarefas atrasadas"));
    }
    if (captures && u.wants("operacao")) parts.push(plural(captures, "captação hoje", "captações hoje"));
    if (followUps && u.wants("comercial")) parts.push(plural(followUps, "follow-up", "follow-ups"));
    if (u.permissions.has("FINANCE_VIEW") && u.wants("financeiro")) {
      if (payToday) parts.push(plural(payToday, "conta vence hoje", "contas vencem hoje"));
      if (payLate) parts.push(plural(payLate, "conta atrasada", "contas atrasadas"));
      if (recLate) parts.push(plural(recLate, "cobrança atrasada", "cobranças atrasadas"));
    }
    if (u.director) {
      if (alertsUrgent && u.wants("alertas")) parts.push(plural(alertsUrgent, "alerta urgente", "alertas urgentes"));
      if (commissionsToPay._count && u.wants("comercial")) parts.push(`${plural(commissionsToPay._count, "comissão", "comissões")} a pagar (${formatCurrency(Number(commissionsToPay._sum.amount ?? 0))})`);
    }
    if (parts.length === 0) continue;

    await notifyUsers({
      organizationId,
      userIds: [u.id],
      title: `Bom dia, ${u.name.split(" ")[0]} ☀️`,
      body: `${parts.join(" · ")}.`,
      link: "/dashboard",
      category: "resumo",
      dedupeKey: `digest:${day}`,
      ignoreQuiet: true,
    });
  }
}

export async function runNotificationRoutine(now = new Date()): Promise<{ organizations: number; errors: string[] }> {
  const orgs = await db.organization.findMany({ select: { id: true } });
  const errors: string[] = [];
  const hour = brasiliaHour(now);
  for (const { id } of orgs) {
    try {
      const team = await loadTeam(id);
      await urgentAlerts(id, team, now);
      await upcoming(id, now);
      if (hour >= 8 && hour < 11) await morningDigest(id, team, now);
    } catch (e) {
      errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  return { organizations: orgs.length, errors };
}
