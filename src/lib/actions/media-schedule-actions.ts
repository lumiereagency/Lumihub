"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { createMonthlySchedule, assignScheduleSlot, clearScheduleSlot, publishSchedule } from "@/lib/media/schedule/schedule-service";
import { findEligibleMembers } from "@/lib/media/schedule/conflict-service";
import { rankEligibleMembers, type RankedEligibleMember } from "@/lib/media/ai/candidate-ranking";
import { sendScheduleConfirmationRequests } from "@/lib/media/tokens/action-tokens";
import { createMonthlyScheduleSchema } from "@/lib/validation/media-schedule";
import type { ActionState } from "@/lib/actions/auth-actions";

const CREATE = permKey("MEDIA_ADESF", "CREATE");
const EDIT = permKey("MEDIA_ADESF", "EDIT");
const MANAGE = permKey("MEDIA_ADESF", "MANAGE");
const DELETE = permKey("MEDIA_ADESF", "DELETE");

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

  // Disparo automático (§ pedido do usuário: publicar já deve avisar todo
  // mundo, sem passo manual extra) — um WhatsApp por membro, nunca um por
  // culto. Falha de envio nunca deve desfazer a publicação já efetivada.
  const dispatch = await sendScheduleConfirmationRequests(scheduleId, user.organizationId).catch(() => null);
  if (dispatch && dispatch.sent > 0) {
    const failedNote = dispatch.failed > 0 ? ` ${dispatch.failed} falha(s) no envio (confira a conexão do WhatsApp).` : "";
    return { success: `Escala publicada. Confirmação enviada por WhatsApp para ${dispatch.sent} membro(s).${failedNote}` };
  }
  if (dispatch && dispatch.failed > 0) {
    return { success: "Escala publicada. Não foi possível enviar a confirmação por WhatsApp — verifique a conexão em Configurações → Integrações." };
  }
  return { success: "Escala publicada." };
}

// Só permite excluir rascunho (§ pedido do usuário) — uma escala PUBLISHED
// já foi vista/confirmada por membros reais e tem histórico de presença;
// excluir teria que apagar isso silenciosamente. Publicada demais, o
// caminho é ARCHIVED, não exclusão. Cascata do banco já cuida de
// atribuições/trocas/execuções de IA ligadas a esta escala.
export async function deleteScheduleAction(scheduleId: string): Promise<ActionState> {
  const user = await requirePermission(DELETE);

  const schedule = await db.mediaSchedule.findFirst({ where: { id: scheduleId, organizationId: user.organizationId } });
  if (!schedule) return { error: "Escala não encontrada." };
  if (schedule.status !== "DRAFT") return { error: "Só é possível excluir escalas em rascunho." };

  await db.mediaSchedule.delete({ where: { id: scheduleId } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_SCHEDULE_DELETED",
    entityType: "MediaSchedule",
    entityId: scheduleId,
    metadata: { name: schedule.name, month: schedule.month, year: schedule.year },
  });

  revalidatePath("/midia-adesf/escalas");
  return { success: "Rascunho excluído." };
}
