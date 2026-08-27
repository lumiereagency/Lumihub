import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { findScheduleConflicts, getMemberAvailabilityState } from "@/lib/media/schedule/conflict-service";
import { notifyMediaMember, notifyMediaLeaders } from "@/lib/media/schedule/notification-service";
import { notifyMemberOfManualAssignment } from "@/lib/media/tokens/action-tokens";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export type EventCoverageStatus = "COMPLETE" | "INCOMPLETE" | "ATTENTION" | "SWAP_PENDING";

export interface EventCoverage {
  eventId: string;
  requiredTotal: number;
  filledTotal: number;
  mandatoryUnfilled: number;
  status: EventCoverageStatus;
}

// Deriva o status de cobertura de um culto (§23) — nunca é cadastrado
// manualmente, sempre calculado a partir das atribuições reais.
export async function getEventCoverage(eventId: string): Promise<EventCoverage> {
  const event = await db.mediaEvent.findUniqueOrThrow({ where: { id: eventId } });
  const [requirements, assignments] = await Promise.all([
    db.mediaEventRequirement.findMany({ where: { eventId } }),
    db.mediaScheduleAssignment.findMany({ where: { eventId } }),
  ]);

  const requiredTotal = requirements.reduce((sum, r) => sum + r.requiredQuantity, 0);
  const filledTotal = assignments.filter((a) => a.memberId).length;

  let mandatoryUnfilled = 0;
  for (const req of requirements) {
    const filledForFn = assignments.filter((a) => a.functionId === req.functionId && a.memberId).length;
    if (req.mandatory && filledForFn < req.requiredQuantity) mandatoryUnfilled += req.requiredQuantity - filledForFn;
  }

  if (assignments.some((a) => a.status === "SWAP_PENDING")) {
    return { eventId, requiredTotal, filledTotal, mandatoryUnfilled, status: "SWAP_PENDING" };
  }
  if (mandatoryUnfilled > 0) {
    return { eventId, requiredTotal, filledTotal, mandatoryUnfilled, status: "INCOMPLETE" };
  }

  for (const a of assignments.filter((a) => a.memberId)) {
    const [conflicts, availability] = await Promise.all([
      findScheduleConflicts(a.memberId!, event.startAt, event.endAt, a.id),
      getMemberAvailabilityState(a.memberId!, event.startAt, event.endAt),
    ]);
    if (conflicts.length > 0 || availability === "UNAVAILABLE") {
      return { eventId, requiredTotal, filledTotal, mandatoryUnfilled, status: "ATTENTION" };
    }
  }

  return { eventId, requiredTotal, filledTotal, mandatoryUnfilled, status: "COMPLETE" };
}

function monthPeriod(month: number, year: number): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return { periodStart, periodEnd };
}

// "Nova Escala Mensal" (§15) — busca os eventos do período automaticamente.
// As vagas (slots) são derivadas ao vivo a partir de MediaEventRequirement
// sempre que a tela de preenchimento é aberta (ver assignScheduleSlot) em
// vez de pré-criadas aqui — isso evita que uma função adicionada/alterada
// depois de a escala já existir (§73) fique presa a um snapshot antigo.
// Eventos sem nenhuma função configurada entram no aviso
// `eventsWithoutRequirements` (§16) em vez de silenciosamente ficar de fora.
export async function createMonthlySchedule(
  organizationId: string,
  month: number,
  year: number,
  userId: string,
): Promise<{ scheduleId: string; eventsWithoutRequirements: string[] }> {
  const { periodStart, periodEnd } = monthPeriod(month, year);

  const existing = await db.mediaSchedule.findFirst({ where: { organizationId, month, year } });
  if (existing) return { scheduleId: existing.id, eventsWithoutRequirements: [] };

  const schedule = await db.mediaSchedule.create({
    data: {
      organizationId,
      name: `Escala ${MONTH_NAMES[month - 1]} ${year}`,
      month,
      year,
      periodStart,
      periodEnd,
      createdByUserId: userId,
    },
  });

  const events = await db.mediaEvent.findMany({
    where: { organizationId, startAt: { gte: periodStart, lte: periodEnd }, status: { notIn: ["CANCELLED", "ARCHIVED"] } },
    include: { requirements: true },
    orderBy: { startAt: "asc" },
  });
  const eventsWithoutRequirements = events.filter((e) => e.requirements.length === 0).map((e) => e.name);

  await audit({
    organizationId,
    userId,
    action: "MEDIA_SCHEDULE_CREATED",
    entityType: "MediaSchedule",
    entityId: schedule.id,
    metadata: { month, year, eventsCount: events.length },
  });

  return { scheduleId: schedule.id, eventsWithoutRequirements };
}

// Preenche (ou substitui) uma vaga identificada por (evento, função, slot)
// dentro de uma escala — cria a linha de atribuição sob demanda se ainda
// não existir (a vaga é conceitual até alguém ser atribuído a ela).
export async function assignScheduleSlot(
  scheduleId: string,
  eventId: string,
  functionId: string,
  slotIndex: number,
  memberId: string,
  actorUserId: string,
  organizationId: string,
  options?: { aiGenerated?: boolean },
): Promise<void> {
  const assignment = await db.mediaScheduleAssignment.upsert({
    where: { scheduleId_eventId_functionId_slotIndex: { scheduleId, eventId, functionId, slotIndex } },
    create: { scheduleId, eventId, functionId, slotIndex },
    update: {},
  });
  await setAssignmentMember(assignment.id, memberId, actorUserId, organizationId, options);
}

export async function clearScheduleSlot(
  scheduleId: string,
  eventId: string,
  functionId: string,
  slotIndex: number,
  actorUserId: string,
  organizationId: string,
): Promise<void> {
  const assignment = await db.mediaScheduleAssignment.findUnique({
    where: { scheduleId_eventId_functionId_slotIndex: { scheduleId, eventId, functionId, slotIndex } },
  });
  if (!assignment) return;
  await clearAssignmentMember(assignment.id, actorUserId, organizationId);
}

export interface PublicationValidation {
  ready: boolean;
  totalEvents: number;
  totalAssignments: number;
  uncoveredMandatory: number;
  conflicts: number;
  unavailabilities: number;
}

// Validação completa antes de publicar (§25) — só bloqueia de verdade por
// vaga obrigatória descoberta; conflitos/indisponibilidades exigem
// confirmação explícita do líder (`force`) porque já passaram por uma
// decisão consciente no momento da atribuição (§20/§22).
export async function validateScheduleForPublication(scheduleId: string): Promise<PublicationValidation> {
  const assignments = await db.mediaScheduleAssignment.findMany({ where: { scheduleId } });
  const eventIds = [...new Set(assignments.map((a) => a.eventId))];

  let uncoveredMandatory = 0;
  let conflicts = 0;
  let unavailabilities = 0;

  for (const eventId of eventIds) {
    const coverage = await getEventCoverage(eventId);
    uncoveredMandatory += coverage.mandatoryUnfilled;
    if (coverage.status === "ATTENTION") {
      const event = await db.mediaEvent.findUniqueOrThrow({ where: { id: eventId } });
      const eventAssignments = assignments.filter((a) => a.eventId === eventId && a.memberId);
      for (const a of eventAssignments) {
        const [c, avail] = await Promise.all([
          findScheduleConflicts(a.memberId!, event.startAt, event.endAt, a.id),
          getMemberAvailabilityState(a.memberId!, event.startAt, event.endAt),
        ]);
        if (c.length > 0) conflicts++;
        if (avail === "UNAVAILABLE") unavailabilities++;
      }
    }
  }

  return {
    ready: uncoveredMandatory === 0,
    totalEvents: eventIds.length,
    totalAssignments: assignments.filter((a) => a.memberId).length,
    uncoveredMandatory,
    conflicts,
    unavailabilities,
  };
}

export async function publishSchedule(
  scheduleId: string,
  userId: string,
  organizationId: string,
  force: boolean,
): Promise<{ error?: string; requiresConfirmation?: boolean; validation?: PublicationValidation }> {
  const validation = await validateScheduleForPublication(scheduleId);
  if (!validation.ready) {
    return { error: `Não é possível publicar: ${validation.uncoveredMandatory} vaga(s) obrigatória(s) sem preenchimento.`, validation };
  }
  if ((validation.conflicts > 0 || validation.unavailabilities > 0) && !force) {
    return { requiresConfirmation: true, validation };
  }

  const assignments = await db.mediaScheduleAssignment.findMany({
    where: { scheduleId, memberId: { not: null } },
    include: { member: true, event: true, function: true },
  });

  await db.$transaction(async (tx) => {
    await tx.mediaSchedule.update({
      where: { id: scheduleId },
      data: { status: "PUBLISHED", publishedByUserId: userId, publishedAt: new Date() },
    });
    for (const a of assignments) {
      await tx.mediaAttendance.upsert({
        where: { assignmentId: a.id },
        create: { assignmentId: a.id, memberId: a.memberId! },
        update: {},
      });
    }
  });

  const perMember = new Map<string, number>();
  for (const a of assignments) perMember.set(a.memberId!, (perMember.get(a.memberId!) ?? 0) + 1);

  const schedule = await db.mediaSchedule.findUniqueOrThrow({ where: { id: scheduleId } });
  for (const [memberId, count] of perMember) {
    await notifyMediaMember(
      organizationId,
      memberId,
      "Nova escala publicada",
      `A ${schedule.name} já está disponível. Você possui ${count} responsabilidade(s) neste período.`,
      "/midia/minha-escala",
    );
  }

  await audit({
    organizationId,
    userId,
    action: "MEDIA_SCHEDULE_PUBLISHED",
    entityType: "MediaSchedule",
    entityId: scheduleId,
    metadata: { totalAssignments: validation.totalAssignments, force },
  });

  return {};
}

// Preenchimento manual ou substituição direta pelo líder (§19/§54) — cobre
// os dois casos com a mesma função: vaga vazia -> preenchida, ou membro A ->
// membro B. Sempre reseta a confirmação/check-in do novo responsável.
export async function setAssignmentMember(
  assignmentId: string,
  memberId: string,
  actorUserId: string,
  organizationId: string,
  options?: { aiGenerated?: boolean },
): Promise<void> {
  const assignment = await db.mediaScheduleAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { event: true, function: true, schedule: true },
  });
  const previousMemberId = assignment.memberId;
  // Qualquer preenchimento manual (options ausente) sempre limpa o marcador
  // de IA — a partir do momento em que o líder mexe na vaga, ela deixa de
  // ser "sugestão automática" mesmo que o membro escolhido seja o mesmo.
  const aiGenerated = options?.aiGenerated ?? false;

  await db.$transaction(async (tx) => {
    await tx.mediaScheduleAssignment.update({
      where: { id: assignmentId },
      data: { memberId, status: "ASSIGNED", assignedByUserId: actorUserId, assignedAt: new Date(), aiGenerated },
    });
    await tx.mediaAttendance.upsert({
      where: { assignmentId },
      create: { assignmentId, memberId },
      update: { memberId, confirmationStatus: "PENDING", confirmedAt: null, checkinStatus: "PENDING", checkedInAt: null },
    });
  });

  await audit({
    organizationId,
    userId: actorUserId,
    action: previousMemberId ? "MEDIA_ASSIGNMENT_MEMBER_REPLACED" : "MEDIA_ASSIGNMENT_FILLED",
    entityType: "MediaScheduleAssignment",
    entityId: assignmentId,
    metadata: { eventId: assignment.eventId, functionId: assignment.functionId, previousMemberId, memberId, aiGenerated },
  });

  const isPublished = assignment.schedule.status === "PUBLISHED";
  if (isPublished) {
    if (previousMemberId && previousMemberId !== memberId) {
      await notifyMediaMember(
        organizationId,
        previousMemberId,
        "Sua escala foi alterada",
        `Você não faz mais parte da escala de ${assignment.function.name} em ${assignment.event.name}.`,
        "/midia/minha-escala",
      );
    }
    await notifyMediaMember(
      organizationId,
      memberId,
      previousMemberId ? "Você foi escalado" : "Nova responsabilidade na escala",
      `Você foi escalado como ${assignment.function.name} em ${assignment.event.name}.`,
      "/midia/minha-escala",
    );

    // Além do sininho do portal (só visto se a pessoa entrar sozinha), avisa
    // por WhatsApp sempre que a vaga muda de dono de verdade — cobre tanto
    // preencher uma vaga vazia quanto substituir quem já estava lá
    // (§ pedido do usuário: "como ela vai saber?").
    if (previousMemberId !== memberId) {
      await notifyMemberOfManualAssignment(organizationId, assignmentId);
    }
  }
}

// Abre a vaga de novo (exceção administrativa, §53) — só o líder chama isto.
export async function clearAssignmentMember(assignmentId: string, actorUserId: string, organizationId: string): Promise<void> {
  const assignment = await db.mediaScheduleAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
  if (!assignment.memberId) return;

  await db.$transaction(async (tx) => {
    await tx.mediaAttendance.deleteMany({ where: { assignmentId } });
    await tx.mediaScheduleAssignment.update({
      where: { id: assignmentId },
      data: { memberId: null, status: "UNASSIGNED", assignedByUserId: null, assignedAt: null },
    });
  });

  await notifyMediaLeaders(
    organizationId,
    "Vaga reaberta manualmente",
    `Uma vaga foi reaberta na escala — verifique a cobertura do evento.`,
    "/midia-adesf/escalas",
  );

  await audit({
    organizationId,
    userId: actorUserId,
    action: "MEDIA_ASSIGNMENT_CLEARED",
    entityType: "MediaScheduleAssignment",
    entityId: assignmentId,
    metadata: { previousMemberId: assignment.memberId },
  });
}

// Carga de trabalho no período (§7 — critério "carga de trabalho" da IA, e
// reaproveitado pelos dashboards da Fase 03 §22/§24). Conta qualquer
// atribuição que de fato ocupou o membro (inclui SWAP_PENDING/ABSENT — só
// UNASSIGNED não conta), nunca apenas as publicadas, para balancear também
// dentro de uma escala ainda em rascunho.
export async function countMemberAssignmentsInPeriod(memberId: string, periodStart: Date, periodEnd: Date): Promise<number> {
  return db.mediaScheduleAssignment.count({
    where: {
      memberId,
      status: { not: "UNASSIGNED" },
      event: { startAt: { gte: periodStart, lte: periodEnd } },
    },
  });
}

// Recência (§7): dias desde a última vez em que o membro foi de fato
// escalado, olhando para TODO o histórico (não só o período da escala
// atual) e sempre para eventos anteriores a `beforeDate`. Retorna null
// quando o membro nunca foi escalado — a IA trata isso como "prioridade
// máxima de recência" (nunca escalado é sempre pelo menos tão urgente
// quanto o caso mais antigo encontrado).
export async function daysSinceLastAssignment(memberId: string, beforeDate: Date): Promise<number | null> {
  const last = await db.mediaScheduleAssignment.findFirst({
    where: {
      memberId,
      status: { not: "UNASSIGNED" },
      event: { startAt: { lt: beforeDate } },
    },
    include: { event: true },
    orderBy: { event: { startAt: "desc" } },
  });
  if (!last) return null;
  return Math.floor((beforeDate.getTime() - last.event.startAt.getTime()) / (24 * 60 * 60 * 1000));
}
