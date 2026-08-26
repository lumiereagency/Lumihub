import "server-only";
import { db } from "@/lib/db";
import { combineBrazilDateAndTime, brazilDateKey } from "@/lib/datetime";

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

// Aplica o template de funções a um evento recém-criado. Idempotente: não
// sobrescreve requisitos já existentes (não faz nada se o evento já tiver
// alguma configuração customizada). Se o evento pertence a uma série
// recorrente com seu próprio template (MediaEventRecurrenceRequirement),
// esse template tem prioridade — cada série pode exigir um conjunto de
// funções diferente; só cai no "Template de Culto" genérico da organização
// (MediaEventDefaultRequirement) para eventos avulsos ou séries sem
// template próprio configurado.
export async function applyDefaultRequirementsToEvent(eventId: string): Promise<void> {
  const existing = await db.mediaEventRequirement.count({ where: { eventId } });
  if (existing > 0) return;

  const event = await db.mediaEvent.findUniqueOrThrow({ where: { id: eventId }, select: { organizationId: true, recurrenceId: true } });

  if (event.recurrenceId) {
    const recurrenceTemplate = await db.mediaEventRecurrenceRequirement.findMany({ where: { recurrenceId: event.recurrenceId } });
    if (recurrenceTemplate.length > 0) {
      await db.mediaEventRequirement.createMany({
        data: recurrenceTemplate.map((r) => ({ eventId, functionId: r.functionId, requiredQuantity: r.requiredQuantity, mandatory: r.mandatory })),
      });
      return;
    }
  }

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

// Grava/atualiza o template de funções de UMA série recorrente e, quando
// pedido, propaga imediatamente para as ocorrências futuras já geradas
// (§ "editar as funções de 01 também altera todo o resto que foi
// replicado"). Nunca toca ocorrências passadas/canceladas/arquivadas —
// só o que ainda vai acontecer é reescrito.
export async function setRecurrenceRequirementsTemplate(
  recurrenceId: string,
  requirements: { functionId: string; requiredQuantity: number; mandatory: boolean }[],
  propagateToFutureOccurrences: boolean,
): Promise<number> {
  await db.$transaction([
    db.mediaEventRecurrenceRequirement.deleteMany({ where: { recurrenceId } }),
    ...(requirements.length > 0
      ? [db.mediaEventRecurrenceRequirement.createMany({ data: requirements.map((r) => ({ recurrenceId, ...r })) })]
      : []),
  ]);

  if (!propagateToFutureOccurrences) return 0;

  const futureEvents = await db.mediaEvent.findMany({
    where: { recurrenceId, startAt: { gte: new Date() }, status: { notIn: ["CANCELLED", "ARCHIVED"] } },
    select: { id: true },
  });

  for (const e of futureEvents) {
    await db.$transaction([
      db.mediaEventRequirement.deleteMany({ where: { eventId: e.id } }),
      ...(requirements.length > 0
        ? [db.mediaEventRequirement.createMany({ data: requirements.map((r) => ({ eventId: e.id, ...r })) })]
        : []),
    ]);
  }

  return futureEvents.length;
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

  let cursor = new Date(recurrence.startDate);
  while (cursor.getDay() !== recurrence.dayOfWeek) cursor = addDays(cursor, 1);

  let created = 0;
  let guard = 0;
  while (cursor <= limit && guard < 520) {
    const dateKey = cursor.toISOString().slice(0, 10);
    if (!existingDates.has(dateKey)) {
      // Nunca usar `.setHours()` aqui: o servidor roda em UTC, então
      // "19:00" virava 19:00 UTC (= 16:00 em Brasília) em vez de 19:00 em
      // Brasília — mesma classe de bug já corrigida uma vez em
      // Captações/Agenda (ver @/lib/datetime), reintroduzida aqui porque a
      // geração de recorrência nunca passava por aquele mesmo caminho.
      const startAt = combineBrazilDateAndTime(dateKey, recurrence.startTime);
      const endAt = recurrence.endTime ? combineBrazilDateAndTime(dateKey, recurrence.endTime) : null;

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

// Sincroniza nome/tipo/local/horário de uma série editada para as
// ocorrências futuras já geradas por ela (§ pedido do usuário: "editar
// não estava obedecendo o horário ser o mesmo em todas"). Só toca o que
// ainda vai acontecer (nunca passado/cancelado/arquivado/concluído) e só
// ajusta a HORA do dia em cada ocorrência — a data de cada uma continua a
// mesma. Mudança de dia da semana não realinha ocorrências já criadas
// para o novo dia (isso exigiria decidir o que fazer com as antigas);
// para isso o caminho é excluir a série e recriar (já existe na tela).
export async function syncRecurrenceScheduleToFutureOccurrences(
  recurrenceId: string,
  fields: { name: string; type: string; location: string | null; startTime: string; endTime: string | null },
): Promise<number> {
  const futureEvents = await db.mediaEvent.findMany({
    where: { recurrenceId, startAt: { gte: new Date() }, status: { notIn: ["CANCELLED", "ARCHIVED", "COMPLETED"] } },
  });

  for (const event of futureEvents) {
    // brazilDateKey (não toISOString) porque event.startAt pode já estar
    // errado (o próprio bug de fuso que este método corrige) — precisamos
    // do dia como o calendário de Brasília entende, não como o instante
    // UTC salvo errado sugere.
    const dateKey = brazilDateKey(event.startAt);
    const startAt = combineBrazilDateAndTime(dateKey, fields.startTime);
    const endAt = fields.endTime ? combineBrazilDateAndTime(dateKey, fields.endTime) : null;

    await db.mediaEvent.update({
      where: { id: event.id },
      data: { name: fields.name, type: fields.type, location: fields.location, startAt, endAt },
    });
    await syncCalendarEventForMediaEvent({
      id: event.id,
      organizationId: event.organizationId,
      name: fields.name,
      startAt,
      endAt,
      location: fields.location,
      description: event.description,
    });
  }

  return futureEvents.length;
}
