import "server-only";
import { db } from "@/lib/db";

// Mantém o CalendarEvent (infraestrutura já existente da LUMIBASE, Fase 7)
// sincronizado com o MediaEvent — evita duplicar um calendário próprio
// (§76). O tipo MIDIA fica fora de MANUALLY_CREATABLE_TYPES (ver
// @/lib/validation/calendar), então a Agenda genérica trata este evento
// como "gerado automaticamente" e não permite editá-lo por lá.
export async function syncCalendarEventForMediaEvent(mediaEvent: {
  id: string;
  organizationId: string;
  name: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  description: string | null;
}): Promise<void> {
  await db.calendarEvent.upsert({
    where: { mediaEventId: mediaEvent.id },
    create: {
      organizationId: mediaEvent.organizationId,
      title: mediaEvent.name,
      type: "MIDIA",
      startAt: mediaEvent.startAt,
      endAt: mediaEvent.endAt,
      location: mediaEvent.location,
      notes: mediaEvent.description,
      mediaEventId: mediaEvent.id,
    },
    update: {
      title: mediaEvent.name,
      startAt: mediaEvent.startAt,
      endAt: mediaEvent.endAt,
      location: mediaEvent.location,
      notes: mediaEvent.description,
    },
  });
}

// Aplica o "Template de Culto" (§88) a um evento recém-criado, copiando o
// conjunto padrão de funções necessárias da organização. Idempotente: não
// sobrescreve requisitos já existentes (não faz nada se o evento já tiver
// alguma configuração customizada).
export async function applyDefaultRequirementsToEvent(eventId: string): Promise<void> {
  const existing = await db.mediaEventRequirement.count({ where: { eventId } });
  if (existing > 0) return;

  const event = await db.mediaEvent.findUniqueOrThrow({ where: { id: eventId }, select: { organizationId: true } });
  const defaults = await db.mediaEventDefaultRequirement.findMany({ where: { organizationId: event.organizationId } });
  if (defaults.length === 0) return;

  await db.mediaEventRequirement.createMany({
    data: defaults.map((d) => ({
      eventId,
      functionId: d.functionId,
      requiredQuantity: d.requiredQuantity,
      mandatory: d.mandatory,
    })),
  });
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Gera as ocorrências concretas de uma recorrência semanal (§8) até
// `throughDate` (ou até `endDate` da regra, o que vier primeiro).
// Idempotente: nunca duplica uma ocorrência já criada para a mesma data.
export async function generateRecurringEventOccurrences(recurrenceId: string, throughDate: Date): Promise<number> {
  const recurrence = await db.mediaEventRecurrence.findUniqueOrThrow({ where: { id: recurrenceId } });
  if (!recurrence.active) return 0;

  const limit = recurrence.endDate && recurrence.endDate < throughDate ? recurrence.endDate : throughDate;

  const existing = await db.mediaEvent.findMany({
    where: { recurrenceId, startAt: { gte: recurrence.startDate } },
    select: { startAt: true },
  });
  const existingDates = new Set(existing.map((e) => e.startAt.toISOString().slice(0, 10)));

  const [startHour, startMinute] = recurrence.startTime.split(":").map(Number);
  const [endHour, endMinute] = recurrence.endTime ? recurrence.endTime.split(":").map(Number) : [null, null];

  let cursor = new Date(recurrence.startDate);
  while (cursor.getDay() !== recurrence.dayOfWeek) cursor = addDays(cursor, 1);

  let created = 0;
  let guard = 0;
  while (cursor <= limit && guard < 520) {
    const dateKey = cursor.toISOString().slice(0, 10);
    if (!existingDates.has(dateKey)) {
      const startAt = new Date(cursor);
      startAt.setHours(startHour, startMinute, 0, 0);
      const endAt = endHour != null && endMinute != null ? new Date(cursor) : null;
      if (endAt && endHour != null && endMinute != null) endAt.setHours(endHour, endMinute, 0, 0);

      const event = await db.mediaEvent.create({
        data: {
          organizationId: recurrence.organizationId,
          name: recurrence.name,
          type: recurrence.type,
          startAt,
          endAt,
          location: recurrence.location,
          status: "SCHEDULED",
          recurrenceId: recurrence.id,
        },
      });
      await applyDefaultRequirementsToEvent(event.id);
      await syncCalendarEventForMediaEvent({ ...event, description: null });
      created++;
    }
    cursor = addDays(cursor, 7);
    guard++;
  }

  return created;
}

// Chamado pela mesma rotina diária de /api/cron/generate-receivables —
// mantém toda recorrência ativa com ocorrências geradas ~90 dias à frente,
// sem nunca gerar no passado.
export async function generateDueMediaEventOccurrences(): Promise<number> {
  const horizon = addDays(new Date(), 90);
  const recurrences = await db.mediaEventRecurrence.findMany({ where: { active: true } });
  let total = 0;
  for (const r of recurrences) {
    total += await generateRecurringEventOccurrences(r.id, horizon);
  }
  return total;
}
