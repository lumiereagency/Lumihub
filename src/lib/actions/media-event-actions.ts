"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import {
  applyDefaultRequirementsToEvent,
  syncCalendarEventForMediaEvent,
  generateRecurringEventOccurrences,
  setRecurrenceRequirementsTemplate,
} from "@/lib/media/schedule/event-service";
import { mediaEventSchema, mediaEventRecurrenceSchema } from "@/lib/validation/media-schedule";
import type { ActionState } from "@/lib/actions/auth-actions";

const CREATE = permKey("MEDIA_ADESF", "CREATE");
const EDIT = permKey("MEDIA_ADESF", "EDIT");
const DELETE = permKey("MEDIA_ADESF", "DELETE");

function parseRequirements(formData: FormData): unknown {
  const raw = formData.get("requirementsJson");
  if (typeof raw !== "string" || !raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function replaceEventRequirements(eventId: string, requirements: { functionId: string; requiredQuantity: number; mandatory: boolean }[]) {
  await db.$transaction([
    db.mediaEventRequirement.deleteMany({ where: { eventId } }),
    ...(requirements.length > 0
      ? [db.mediaEventRequirement.createMany({ data: requirements.map((r) => ({ eventId, ...r })) })]
      : []),
  ]);
}

export async function createEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(CREATE);

  const parsed = mediaEventSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "Culto",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    location: formData.get("location"),
    description: formData.get("description"),
    administrativeNotes: formData.get("administrativeNotes"),
    requirements: parseRequirements(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };

  const event = await db.mediaEvent.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      type: parsed.data.type,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt ?? null,
      location: parsed.data.location ?? null,
      description: parsed.data.description ?? null,
      administrativeNotes: parsed.data.administrativeNotes ?? null,
      createdByUserId: user.id,
    },
  });

  if (parsed.data.requirements.length > 0) {
    await db.mediaEventRequirement.createMany({ data: parsed.data.requirements.map((r) => ({ eventId: event.id, ...r })) });
  } else {
    await applyDefaultRequirementsToEvent(event.id);
  }
  await syncCalendarEventForMediaEvent({ ...event, description: parsed.data.description ?? null });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_EVENT_CREATED",
    entityType: "MediaEvent",
    entityId: event.id,
    metadata: { name: event.name, startAt: event.startAt },
  });

  revalidatePath("/midia-adesf/cultos");
  revalidatePath("/midia-adesf/calendario");
  revalidatePath("/midia/calendario");
  return { success: "Culto/evento criado." };
}

export async function updateEventAction(eventId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(EDIT);

  const parsed = mediaEventSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "Culto",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    location: formData.get("location"),
    description: formData.get("description"),
    administrativeNotes: formData.get("administrativeNotes"),
    requirements: parseRequirements(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };

  const existing = await db.mediaEvent.findFirst({ where: { id: eventId, organizationId: user.organizationId } });
  if (!existing) return { error: "Evento não encontrado." };

  const event = await db.mediaEvent.update({
    where: { id: eventId },
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt ?? null,
      location: parsed.data.location ?? null,
      description: parsed.data.description ?? null,
      administrativeNotes: parsed.data.administrativeNotes ?? null,
    },
  });
  await replaceEventRequirements(eventId, parsed.data.requirements);
  await syncCalendarEventForMediaEvent({ ...event, description: parsed.data.description ?? null });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_EVENT_UPDATED",
    entityType: "MediaEvent",
    entityId: eventId,
  });

  revalidatePath("/midia-adesf/cultos");
  revalidatePath(`/midia-adesf/cultos/${eventId}`);
  revalidatePath("/midia-adesf/calendario");
  revalidatePath("/midia/calendario");
  return { success: "Culto/evento atualizado." };
}

export async function cancelEventAction(eventId: string): Promise<void> {
  const user = await requirePermission(DELETE);

  const event = await db.mediaEvent.findFirst({ where: { id: eventId, organizationId: user.organizationId } });
  if (!event) return;

  await db.mediaEvent.update({ where: { id: eventId }, data: { status: "CANCELLED" } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_EVENT_CANCELLED",
    entityType: "MediaEvent",
    entityId: eventId,
  });

  revalidatePath("/midia-adesf/cultos");
  revalidatePath("/midia-adesf/calendario");
  revalidatePath("/midia/calendario");
}

// Salva o conjunto atual de funções de um culto como o novo "Template de
// Culto" padrão da organização (§87/§88) — próximos eventos criados sem
// customizar já vêm com esta configuração.
export async function saveEventRequirementsAsDefaultAction(eventId: string): Promise<void> {
  const user = await requirePermission(EDIT);

  const event = await db.mediaEvent.findFirst({ where: { id: eventId, organizationId: user.organizationId }, include: { requirements: true } });
  if (!event) return;

  await db.$transaction([
    db.mediaEventDefaultRequirement.deleteMany({ where: { organizationId: user.organizationId } }),
    ...(event.requirements.length > 0
      ? [
          db.mediaEventDefaultRequirement.createMany({
            data: event.requirements.map((r) => ({
              organizationId: user.organizationId,
              functionId: r.functionId,
              requiredQuantity: r.requiredQuantity,
              mandatory: r.mandatory,
            })),
          }),
        ]
      : []),
  ]);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_EVENT_DEFAULT_REQUIREMENTS_UPDATED",
    entityType: "MediaEvent",
    entityId: eventId,
  });
}

export async function createRecurrenceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(CREATE);

  const parsed = mediaEventRecurrenceSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "Culto",
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    location: formData.get("location"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    requirements: parseRequirements(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };

  const recurrence = await db.mediaEventRecurrence.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      type: parsed.data.type,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime ?? null,
      location: parsed.data.location ?? null,
      startDate: new Date(`${parsed.data.startDate}T00:00:00Z`),
      endDate: parsed.data.endDate ? new Date(`${parsed.data.endDate}T00:00:00Z`) : null,
    },
  });

  if (parsed.data.requirements.length > 0) {
    await setRecurrenceRequirementsTemplate(recurrence.id, parsed.data.requirements, false);
  }

  const created = await generateRecurringEventOccurrences(recurrence.id, new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_EVENT_RECURRENCE_CREATED",
    entityType: "MediaEventRecurrence",
    entityId: recurrence.id,
    metadata: { eventsGenerated: created },
  });

  revalidatePath("/midia-adesf/cultos");
  revalidatePath("/midia-adesf/calendario");
  revalidatePath("/midia/calendario");
  return { success: `Série criada — ${created} ocorrência(s) gerada(s) para os próximos 90 dias.` };
}

export async function toggleRecurrenceActiveAction(recurrenceId: string, active: boolean): Promise<void> {
  const user = await requirePermission(EDIT);

  const recurrence = await db.mediaEventRecurrence.findFirst({ where: { id: recurrenceId, organizationId: user.organizationId } });
  if (!recurrence) return;

  await db.mediaEventRecurrence.update({ where: { id: recurrenceId }, data: { active } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: active ? "MEDIA_EVENT_RECURRENCE_REACTIVATED" : "MEDIA_EVENT_RECURRENCE_PAUSED",
    entityType: "MediaEventRecurrence",
    entityId: recurrenceId,
  });

  revalidatePath("/midia-adesf/cultos");
}

// "Editar as funções de UM culto também altera todo o resto da série"
// (pedido do usuário): grava as funções atuais deste evento como o
// template da série inteira e reescreve todas as ocorrências futuras
// (nunca passadas/canceladas/arquivadas) para o mesmo conjunto.
export async function applyEventRequirementsToRecurrenceAction(eventId: string): Promise<ActionState> {
  const user = await requirePermission(EDIT);

  const event = await db.mediaEvent.findFirst({
    where: { id: eventId, organizationId: user.organizationId },
    include: { requirements: true },
  });
  if (!event) return { error: "Evento não encontrado." };
  if (!event.recurrenceId) return { error: "Este culto não pertence a uma série recorrente." };

  const requirements = event.requirements.map((r) => ({ functionId: r.functionId, requiredQuantity: r.requiredQuantity, mandatory: r.mandatory }));
  const updatedCount = await setRecurrenceRequirementsTemplate(event.recurrenceId, requirements, true);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_EVENT_RECURRENCE_REQUIREMENTS_PROPAGATED",
    entityType: "MediaEventRecurrence",
    entityId: event.recurrenceId,
    metadata: { sourceEventId: eventId, updatedCount },
  });

  revalidatePath("/midia-adesf/cultos");
  revalidatePath(`/midia-adesf/cultos/${eventId}`);
  return { success: `Funções aplicadas a toda a série — ${updatedCount} ocorrência(s) futura(s) atualizada(s).` };
}
