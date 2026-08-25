"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMediaMember } from "@/lib/auth/guard";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { requestSwap, respondToSwapAsTarget, cancelSwap, approveSwapAsLeader } from "@/lib/media/schedule/swap-service";
import { findEligibleMembers, type EligibleMemberCandidate } from "@/lib/media/schedule/conflict-service";
import { requestSwapSchema, swapDecisionSchema } from "@/lib/validation/media-schedule";
import type { ActionState } from "@/lib/actions/auth-actions";

// Candidatos elegíveis para uma troca (§46) — o próprio solicitante nunca
// aparece na lista (excludeMemberId). Deliberadamente NÃO usa o ranking de
// IA (rankEligibleMembers): essa pontuação é derivada de carga/recência de
// TODOS os candidatos, e expô-la a um MEMBRO comum aqui vazaria comparação
// entre colegas pela própria resposta da server action — o ranking por IA
// fica restrito às telas de liderança (slot-assign-drawer), que já exigem
// MEDIA_ADESF_EDIT/MANAGE.
export async function getEligibleMembersForSwapAction(assignmentId: string): Promise<EligibleMemberCandidate[]> {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const assignment = await db.mediaScheduleAssignment.findFirst({
    where: { id: assignmentId, memberId: member.id },
    include: { event: true },
  });
  if (!assignment) return [];

  return findEligibleMembers(user.organizationId, assignment.functionId, assignment.event.startAt, assignment.event.endAt, assignment.eventId, member.id);
}

// Todas as ações de membro abaixo derivam o memberId da sessão
// (requireMediaMember()) e nunca de um parâmetro do cliente — elimina IDOR
// por construção (§81: membro A não pode agir sobre atribuição de B).

export async function requestSwapAction(assignmentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMediaMember();

  const parsed = requestSwapSchema.safeParse({ targetMemberId: formData.get("targetMemberId"), reason: formData.get("reason") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Selecione um membro." };

  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });
  const result = await requestSwap(user.organizationId, user.id, assignmentId, member.id, parsed.data.targetMemberId, parsed.data.reason ?? null);

  revalidatePath("/midia/minha-escala");
  revalidatePath("/midia/solicitacoes");
  return result;
}

export async function respondToSwapAction(swapId: string, accept: boolean): Promise<ActionState> {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const result = await respondToSwapAsTarget(user.organizationId, user.id, swapId, member.id, accept);

  revalidatePath("/midia/solicitacoes");
  revalidatePath("/midia/minha-escala");
  return result;
}

export async function cancelSwapAction(swapId: string): Promise<ActionState> {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const result = await cancelSwap(user.organizationId, user.id, swapId, member.id);

  revalidatePath("/midia/solicitacoes");
  revalidatePath("/midia/minha-escala");
  return result;
}

// Aprovação da liderança — funciona tanto para admin LUMIBASE quanto para
// LÍDER operando de dentro do portal, já que ambos carregam a mesma
// permissão MEDIA_ADESF_EDIT (ver união aditiva em @/lib/auth/permissions).
export async function decideSwapAction(swapId: string, approve: boolean, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("MEDIA_ADESF", "EDIT"));

  const parsed = swapDecisionSchema.safeParse({ decisionNotes: formData.get("decisionNotes") });
  if (!parsed.success) return { error: "Verifique os dados informados." };

  const result = await approveSwapAsLeader(user.organizationId, swapId, user.id, approve, parsed.data.decisionNotes ?? null);

  revalidatePath("/midia-adesf/solicitacoes");
  revalidatePath("/midia/solicitacoes");
  revalidatePath("/midia-adesf/escalas");
  revalidatePath("/midia/minha-escala");
  return result;
}
