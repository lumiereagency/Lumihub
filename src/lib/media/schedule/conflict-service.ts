import "server-only";
import { db } from "@/lib/db";

export type AvailabilityState = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function defaultEnd(startAt: Date, endAt: Date | null): Date {
  return endAt ?? new Date(startAt.getTime() + 60 * 60 * 1000);
}

function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

// A disponibilidade recorrente (Fase 01) só guarda janelas em que o membro
// SE DECLAROU disponível — não existe linha "indisponível" recorrente na UI
// atual. Por isso: se o membro nunca configurou aquele dia da semana, o
// resultado é "sem informação"; se configurou o dia mas o horário do evento
// cai fora das janelas declaradas, o resultado é "indisponível". Exceções
// pontuais (que podem ser true OU false) sempre têm prioridade quando
// cobrem o horário do evento.
export async function getMemberAvailabilityState(memberId: string, startAt: Date, endAtInput: Date | null): Promise<AvailabilityState> {
  const endAt = defaultEnd(startAt, endAtInput);
  const dateOnly = new Date(Date.UTC(startAt.getFullYear(), startAt.getMonth(), startAt.getDate()));

  const exceptions = await db.mediaAvailabilityException.findMany({ where: { memberId, date: dateOnly } });
  for (const ex of exceptions) {
    const exStart = new Date(dateOnly);
    exStart.setUTCMinutes(timeStringToMinutes(ex.startTime));
    const exEnd = new Date(dateOnly);
    exEnd.setUTCMinutes(timeStringToMinutes(ex.endTime));
    if (overlaps(startAt, endAt, exStart, exEnd)) {
      return ex.available ? "AVAILABLE" : "UNAVAILABLE";
    }
  }

  const dayOfWeek = startAt.getDay();
  const recurring = await db.mediaAvailabilityRecurring.findMany({ where: { memberId, dayOfWeek } });
  if (recurring.length === 0) return "UNKNOWN";

  const dayStart = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate());
  for (const slot of recurring) {
    const slotStart = new Date(dayStart);
    slotStart.setMinutes(timeStringToMinutes(slot.startTime));
    const slotEnd = new Date(dayStart);
    slotEnd.setMinutes(timeStringToMinutes(slot.endTime));
    if (overlaps(startAt, endAt, slotStart, slotEnd)) return "AVAILABLE";
  }
  return "UNAVAILABLE";
}

export interface ConflictingAssignment {
  assignmentId: string;
  eventId: string;
  eventName: string;
  startAt: Date;
  endAt: Date | null;
  functionName: string;
}

// Conflito real de horário (§21): outra atribuição do MESMO membro, em
// evento diferente, com sobreposição de horário. Não considera a própria
// atribuição sendo avaliada (excludeAssignmentId) nem vagas já liberadas.
export async function findScheduleConflicts(memberId: string, startAt: Date, endAtInput: Date | null, excludeAssignmentId?: string): Promise<ConflictingAssignment[]> {
  const endAt = defaultEnd(startAt, endAtInput);
  const windowStart = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);

  const assignments = await db.mediaScheduleAssignment.findMany({
    where: {
      memberId,
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
      status: { in: ["ASSIGNED", "CONFIRMED", "SWAP_PENDING"] },
      event: { startAt: { gte: windowStart, lte: windowEnd } },
    },
    include: { event: true, function: true },
  });

  return assignments
    .filter((a) => overlaps(startAt, endAt, a.event.startAt, defaultEnd(a.event.startAt, a.event.endAt)))
    .map((a) => ({
      assignmentId: a.id,
      eventId: a.eventId,
      eventName: a.event.name,
      startAt: a.event.startAt,
      endAt: a.event.endAt,
      functionName: a.function.name,
    }));
}

// Membro já possui outra função no MESMO culto (§22) — checagem separada de
// conflito de horário entre eventos diferentes.
export async function findSameEventOtherFunction(memberId: string, eventId: string, excludeAssignmentId?: string) {
  return db.mediaScheduleAssignment.findFirst({
    where: {
      memberId,
      eventId,
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
      status: { in: ["ASSIGNED", "CONFIRMED", "SWAP_PENDING"] },
    },
    include: { function: true },
  });
}

export interface EligibleMemberCandidate {
  memberId: string;
  name: string;
  avatarUrl: string | null;
  functionStatus: string;
  availability: AvailabilityState;
  conflicts: ConflictingAssignment[];
  sameEventOtherFunction: string | null;
}

// Lista de candidatos para preencher uma vaga (§19/§46) — membros ativos
// habilitados para a função, com disponibilidade e conflitos já calculados
// para que a UI decida o que mostrar como aviso, sem esconder ninguém: a
// liderança sempre pode atribuir mesmo com alerta (override), só não pode
// fazer isso sem ver o alerta.
export async function findEligibleMembers(
  organizationId: string,
  functionId: string,
  eventStartAt: Date,
  eventEndAt: Date | null,
  eventId: string,
  excludeMemberId?: string,
): Promise<EligibleMemberCandidate[]> {
  const memberFunctions = await db.mediaMemberFunction.findMany({
    where: {
      functionId,
      member: { organizationId, status: "ACTIVE", id: excludeMemberId ? { not: excludeMemberId } : undefined },
    },
    include: { member: { include: { user: { select: { name: true, avatarUrl: true } } } } },
  });

  const candidates: EligibleMemberCandidate[] = [];
  for (const mf of memberFunctions) {
    const [availability, conflicts, sameEvent] = await Promise.all([
      getMemberAvailabilityState(mf.memberId, eventStartAt, eventEndAt),
      findScheduleConflicts(mf.memberId, eventStartAt, eventEndAt),
      findSameEventOtherFunction(mf.memberId, eventId),
    ]);
    candidates.push({
      memberId: mf.memberId,
      name: mf.member.user.name,
      avatarUrl: mf.member.user.avatarUrl,
      functionStatus: mf.status,
      availability,
      conflicts,
      sameEventOtherFunction: sameEvent?.function.name ?? null,
    });
  }

  return candidates.sort((a, b) => a.name.localeCompare(b.name));
}
