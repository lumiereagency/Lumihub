import "server-only";
import { db } from "@/lib/db";

// Dias de meio de semana com culto (§ pedido do usuário: quarta e sexta) —
// não vem de configuração porque a regra é sobre COMPORTAMENTO do membro
// (garantir gente disponível fora do domingo), não sobre quais dias a
// igreja tem culto (isso já é livre via recorrências em Cultos).
export const WEEKDAY_COVERAGE_DAYS = [3, 5] as const; // quarta, sexta
const PENDING_SPECIAL_EVENTS_WINDOW_DAYS = 60;

export interface WeekdayCoverageStatus {
  satisfied: boolean;
  monthLabel: string;
}

// Cobertura mínima de meio de semana (§ pedido do usuário): não exige toda
// quarta/sexta do membro, só que ele tenha disponibilidade — recorrente OU
// uma exceção pontual — para pelo menos UMA data de quarta ou sexta dentro
// do mês corrente. Isso evita travar um compromisso permanente e ainda
// garante um piso de gente disponível para os cultos de meio de semana.
export async function getWeekdayCoverageStatus(memberId: string, referenceDate: Date = new Date()): Promise<WeekdayCoverageStatus> {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

  const [recurringCount, exceptions] = await Promise.all([
    db.mediaAvailabilityRecurring.count({
      where: { memberId, dayOfWeek: { in: [...WEEKDAY_COVERAGE_DAYS] }, available: true },
    }),
    db.mediaAvailabilityException.findMany({
      where: { memberId, available: true, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true },
    }),
  ]);

  const exceptionSatisfied = exceptions.some((e) => (WEEKDAY_COVERAGE_DAYS as readonly number[]).includes(e.date.getUTCDay()));

  return {
    satisfied: recurringCount > 0 || exceptionSatisfied,
    monthLabel: monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

export interface PendingSpecialEvent {
  eventId: string;
  name: string;
  startAt: Date;
  location: string | null;
}

// Cultos/eventos avulsos (festividades, congressos — recurrenceId nulo)
// para os quais este membro tem alguma função habilitada, ainda não foi
// escalado, e ainda não registrou disponibilidade (nem recorrente nem
// exceção) para a data. Antes, só apareciam se o líder clicasse em
// "perguntar disponibilidade por WhatsApp" evento por evento — agora
// aparecem sozinhos aqui assim que o evento é criado, sem depender de
// nenhum disparo manual (e sem custo extra de WhatsApp).
export async function getPendingSpecialEvents(organizationId: string, memberId: string): Promise<PendingSpecialEvent[]> {
  const memberFunctions = await db.mediaMemberFunction.findMany({ where: { memberId }, select: { functionId: true } });
  if (memberFunctions.length === 0) return [];
  const functionIds = memberFunctions.map((f) => f.functionId);

  const now = new Date();
  const windowEnd = new Date(now.getTime() + PENDING_SPECIAL_EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const events = await db.mediaEvent.findMany({
    where: {
      organizationId,
      recurrenceId: null,
      status: "SCHEDULED",
      startAt: { gte: now, lte: windowEnd },
      requirements: { some: { functionId: { in: functionIds } } },
      assignments: { none: { memberId } },
    },
    orderBy: { startAt: "asc" },
  });
  if (events.length === 0) return [];

  const dates = events.map((e) => new Date(Date.UTC(e.startAt.getFullYear(), e.startAt.getMonth(), e.startAt.getDate())));
  const exceptions = await db.mediaAvailabilityException.findMany({
    where: { memberId, date: { in: dates } },
    select: { date: true },
  });
  const answeredDates = new Set(exceptions.map((e) => e.date.getTime()));

  return events
    .filter((e) => !answeredDates.has(Date.UTC(e.startAt.getFullYear(), e.startAt.getMonth(), e.startAt.getDate())))
    .map((e) => ({ eventId: e.id, name: e.name, startAt: e.startAt, location: e.location }));
}
