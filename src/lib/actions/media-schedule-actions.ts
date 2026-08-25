"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { createMonthlySchedule, assignScheduleSlot, clearScheduleSlot, publishSchedule } from "@/lib/media/schedule/schedule-service";
import { findEligibleMembers } from "@/lib/media/schedule/conflict-service";
import { rankEligibleMembers, type RankedEligibleMember } from "@/lib/media/ai/candidate-ranking";
import { createMonthlyScheduleSchema } from "@/lib/validation/media-schedule";
import type { ActionState } from "@/lib/actions/auth-actions";

const CREATE = permKey("MEDIA_ADESF", "CREATE");
const EDIT = permKey("MEDIA_ADESF", "EDIT");
const MANAGE = permKey("MEDIA_ADESF", "MANAGE");

export async function createMonthlyScheduleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(CREATE);

  const parsed = createMonthlyScheduleSchema.safeParse({ month: formData.get("month"), year: formData.get("year") });
  if (!parsed.success) return { error: "Selecione mês e ano válidos." };

  const { eventsWithoutRequirements } = await createMonthlySchedule(user.organizationId, parsed.data.month, parsed.data.year, user.id);

  revalidatePath("/midia-adesf/escalas");

  if (eventsWithoutRequirements.length > 0) {
    return {
      success: `Escala criada. Atenção: ${eventsWithoutRequirements.length} evento(s) ainda não têm funções configuradas (${eventsWithoutRequirements.join(", ")}).`,
    };
  }
  return { success: "Escala mensal criada." };
}

export async function getEligibleMembersForSlotAction(scheduleId: string, eventId: string, functionId: string): Promise<RankedEligibleMember[]> {
  const user = await requirePermission(EDIT);

  const [schedule, event] = await Promise.all([
    db.mediaSchedule.findFirst({ where: { id: scheduleId, organizationId: user.organizationId } }),
    db.mediaEvent.findFirst({ where: { id: eventId, organizationId: user.organizationId } }),
  ]);
  if (!schedule || !event) return [];

  const candidates = await findEligibleMembers(user.organizationId, functionId, event.startAt, event.endAt, eventId);
  return rankEligibleMembers(user.organizationId, candidates, functionId, schedule.periodStart, schedule.periodEnd, event.startAt);
}

export async function assignScheduleSlotAction(
  scheduleId: string,
  eventId: string,
  functionId: string,
  slotIndex: number,
  memberId: string,
): Promise<ActionState> {
  const user = await requirePermission(EDIT);

  const schedule = await db.mediaSchedule.findFirst({ where: { id: scheduleId, organizationId: user.organizationId } });
  if (!schedule) return { error: "Escala não encontrada." };

  await assignScheduleSlot(scheduleId, eventId, functionId, slotIndex, memberId, user.id, user.organizationId);

  revalidatePath(`/midia-adesf/escalas/${scheduleId}`);
  return { success: "Vaga preenchida." };
}

export async function clearScheduleSlotAction(scheduleId: string, eventId: string, functionId: string, slotIndex: number): Promise<void> {
  const user = await requirePermission(EDIT);

  const schedule = await db.mediaSchedule.findFirst({ where: { id: scheduleId, organizationId: user.organizationId } });
  if (!schedule) return;

  await clearScheduleSlot(scheduleId, eventId, functionId, slotIndex, user.id, user.organizationId);

  revalidatePath(`/midia-adesf/escalas/${scheduleId}`);
}

export async function publishScheduleAction(scheduleId: string, force: boolean): Promise<ActionState & { requiresConfirmation?: boolean }> {
  const user = await requirePermission(MANAGE);

  const schedule = await db.mediaSchedule.findFirst({ where: { id: scheduleId, organizationId: user.organizationId } });
  if (!schedule) return { error: "Escala não encontrada." };

  const result = await publishSchedule(scheduleId, user.id, user.organizationId, force);
  if (result.error) return { error: result.error };
  if (result.requiresConfirmation) {
    return {
      requiresConfirmation: true,
      error: `Revisão necessária: ${result.validation?.conflicts ?? 0} conflito(s) e ${result.validation?.unavailabilities ?? 0} indisponibilidade(s). Confirme para publicar mesmo assim.`,
    };
  }

  revalidatePath(`/midia-adesf/escalas/${scheduleId}`);
  revalidatePath("/midia-adesf/escalas");
  revalidatePath("/midia/escala");
  revalidatePath("/midia/minha-escala");
  return { success: "Escala publicada." };
}
