import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { findScheduleConflicts, getMemberAvailabilityState } from "@/lib/media/schedule/conflict-service";
import { notifyMediaMember, notifyMediaLeaders } from "@/lib/media/schedule/notification-service";

interface ServiceResult {
  error?: string;
  success?: string;
}

// Solicitação de troca (§45-48). A atribuição original permanece válida até
// aprovação da liderança (§44) — nunca some da escala nesse meio-tempo.
export async function requestSwap(
  organizationId: string,
  actorUserId: string,
  assignmentId: string,
  requestedByMemberId: string,
  targetMemberId: string,
  reason: string | null,
  autoSuggested: boolean = false,
): Promise<ServiceResult> {
  const assignment = await db.mediaScheduleAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { event: true, function: true },
  });

  if (assignment.memberId !== requestedByMemberId) {
    return { error: "Esta atribuição não pertence a você." };
  }
  if (targetMemberId === requestedByMemberId) {
    return { error: "Selecione outro membro para a troca." };
  }

  const existingActive = await db.mediaSwapRequest.findFirst({
    where: { assignmentId, status: { in: ["PENDING_TARGET", "TARGET_ACCEPTED", "PENDING_LEADER"] } },
  });
  if (existingActive) return { error: "Já existe uma solicitação de troca em andamento para esta atribuição." };

  const targetHasFunction = await db.mediaMemberFunction.findFirst({
    where: { memberId: targetMemberId, functionId: assignment.functionId },
  });
  if (!targetHasFunction) return { error: "O membro selecionado não está habilitado para esta função." };

  const target = await db.mediaMember.findUnique({ where: { id: targetMemberId } });
  if (!target || target.status !== "ACTIVE") return { error: "O membro selecionado não está ativo." };

  await db.$transaction(async (tx) => {
    await tx.mediaSwapRequest.create({
      data: { organizationId, assignmentId, requestedByMemberId, targetMemberId, reason, autoSuggested },
    });
    await tx.mediaScheduleAssignment.update({ where: { id: assignmentId }, data: { status: "SWAP_PENDING" } });
  });

  await notifyMediaMember(
    organizationId,
    targetMemberId,
    "Solicitação de troca",
    `Um colega solicitou que você assuma ${assignment.function.name} em ${assignment.event.name}.`,
    "/midia/solicitacoes",
  );

  await audit({
    organizationId,
    userId: actorUserId,
    action: "MEDIA_SWAP_REQUESTED",
    entityType: "MediaScheduleAssignment",
    entityId: assignmentId,
    metadata: { requestedByMemberId, targetMemberId },
  });

  return { success: "Solicitação de troca enviada." };
}

async function revertAssignmentAfterSwap(assignmentId: string): Promise<void> {
  await db.mediaScheduleAssignment.update({ where: { id: assignmentId }, data: { status: "ASSIGNED" } });
}

export async function respondToSwapAsTarget(
  organizationId: string,
  actorUserId: string,
  swapId: string,
  targetMemberId: string,
  accept: boolean,
): Promise<ServiceResult> {
  const swap = await db.mediaSwapRequest.findUniqueOrThrow({
    where: { id: swapId },
    include: { assignment: { include: { event: true, function: true } } },
  });
  if (swap.targetMemberId !== targetMemberId) return { error: "Esta solicitação não é destinada a você." };
  if (swap.status !== "PENDING_TARGET") return { error: "Esta solicitação já foi respondida." };

  if (!accept) {
    await db.$transaction(async (tx) => {
      await tx.mediaSwapRequest.update({ where: { id: swapId }, data: { status: "TARGET_REJECTED", targetRespondedAt: new Date() } });
      await revertAssignmentAfterSwap(swap.assignmentId);
    });
    await notifyMediaMember(
      organizationId,
      swap.requestedByMemberId,
      "Troca recusada",
      `O membro selecionado não pôde assumir ${swap.assignment.function.name} em ${swap.assignment.event.name}.`,
      "/midia/solicitacoes",
    );
    await audit({ organizationId, userId: actorUserId, action: "MEDIA_SWAP_REJECTED_BY_TARGET", entityType: "MediaSwapRequest", entityId: swapId });
    return { success: "Troca recusada." };
  }

  await db.mediaSwapRequest.update({ where: { id: swapId }, data: { status: "PENDING_LEADER", targetRespondedAt: new Date() } });
  await notifyMediaLeaders(
    organizationId,
    "Troca aguardando aprovação",
    `Uma troca de ${swap.assignment.function.name} em ${swap.assignment.event.name} está pronta para sua aprovação.`,
    "/midia-adesf/solicitacoes",
  );
  await audit({ organizationId, userId: actorUserId, action: "MEDIA_SWAP_ACCEPTED_BY_TARGET", entityType: "MediaSwapRequest", entityId: swapId });
  return { success: "Troca aceita — aguardando aprovação da liderança." };
}

export async function cancelSwap(organizationId: string, actorUserId: string, swapId: string, requesterMemberId: string): Promise<ServiceResult> {
  const swap = await db.mediaSwapRequest.findUniqueOrThrow({ where: { id: swapId } });
  if (swap.requestedByMemberId !== requesterMemberId) return { error: "Esta solicitação não pertence a você." };
  if (!["PENDING_TARGET", "PENDING_LEADER"].includes(swap.status)) return { error: "Esta solicitação não pode mais ser cancelada." };

  await db.$transaction(async (tx) => {
    await tx.mediaSwapRequest.update({ where: { id: swapId }, data: { status: "CANCELLED" } });
    await revertAssignmentAfterSwap(swap.assignmentId);
  });
  await audit({ organizationId, userId: actorUserId, action: "MEDIA_SWAP_CANCELLED", entityType: "MediaSwapRequest", entityId: swapId });
  return { success: "Solicitação cancelada." };
}

// Aprovação da liderança (§50-52) — única etapa que de fato move o membro
// na atribuição. Revalida tudo do zero (nunca confia na validação feita na
// criação da solicitação, pois os dados podem ter mudado) e roda em
// transação: ou tudo aplica, ou nada muda.
export async function approveSwapAsLeader(
  organizationId: string,
  swapId: string,
  leaderUserId: string,
  approve: boolean,
  decisionNotes: string | null,
): Promise<ServiceResult> {
  const swap = await db.mediaSwapRequest.findUniqueOrThrow({
    where: { id: swapId },
    include: { assignment: { include: { event: true, function: true } } },
  });
  // Trava de tenant (§81/§98): quem aprova é identificado só por ter a
  // permissão MEDIA_ADESF_EDIT dentro da própria organização — sem checar
  // aqui, um swapId de outra organização seria aprovável cruzando tenants.
  if (swap.organizationId !== organizationId) return { error: "Solicitação não encontrada." };
  if (swap.status !== "PENDING_LEADER") return { error: "Esta solicitação não está aguardando aprovação." };

  if (!approve) {
    await db.$transaction(async (tx) => {
      await tx.mediaSwapRequest.update({
        where: { id: swapId },
        data: { status: "REJECTED", leaderRespondedAt: new Date(), leaderUserId, decisionNotes },
      });
      await revertAssignmentAfterSwap(swap.assignmentId);
    });
    await notifyMediaMember(
      organizationId,
      swap.requestedByMemberId,
      "Troca recusada pela liderança",
      `A troca de ${swap.assignment.function.name} em ${swap.assignment.event.name} não foi aprovada.`,
      "/midia/solicitacoes",
    );
    await audit({ organizationId, userId: leaderUserId, action: "MEDIA_SWAP_REJECTED_BY_LEADER", entityType: "MediaSwapRequest", entityId: swapId, metadata: { decisionNotes } });
    return { success: "Troca recusada." };
  }

  // Revalidação completa antes de aprovar (§51).
  const target = await db.mediaMember.findUnique({ where: { id: swap.targetMemberId } });
  if (!target || target.status !== "ACTIVE") return { error: "O substituto não está mais ativo." };
  const targetHasFunction = await db.mediaMemberFunction.findFirst({ where: { memberId: swap.targetMemberId, functionId: swap.assignment.functionId } });
  if (!targetHasFunction) return { error: "O substituto não está mais habilitado para esta função." };
  const conflicts = await findScheduleConflicts(swap.targetMemberId, swap.assignment.event.startAt, swap.assignment.event.endAt, swap.assignmentId);
  if (conflicts.length > 0) return { error: "O substituto agora possui conflito de horário com outra atribuição." };
  const availability = await getMemberAvailabilityState(swap.targetMemberId, swap.assignment.event.startAt, swap.assignment.event.endAt);

  await db.$transaction(async (tx) => {
    await tx.mediaScheduleAssignment.update({
      where: { id: swap.assignmentId },
      data: { memberId: swap.targetMemberId, status: "ASSIGNED", assignedByUserId: leaderUserId, assignedAt: new Date() },
    });
    await tx.mediaAttendance.upsert({
      where: { assignmentId: swap.assignmentId },
      create: { assignmentId: swap.assignmentId, memberId: swap.targetMemberId },
      update: { memberId: swap.targetMemberId, confirmationStatus: "PENDING", confirmedAt: null, checkinStatus: "PENDING", checkedInAt: null },
    });
    await tx.mediaSwapRequest.update({
      where: { id: swapId },
      data: { status: "APPROVED", leaderRespondedAt: new Date(), leaderUserId, decisionNotes },
    });
  });

  await Promise.all([
    notifyMediaMember(
      organizationId,
      swap.requestedByMemberId,
      "Troca aprovada",
      `Sua troca foi aprovada — você não é mais responsável por ${swap.assignment.function.name} em ${swap.assignment.event.name}.`,
      "/midia/minha-escala",
    ),
    notifyMediaMember(
      organizationId,
      swap.targetMemberId,
      "Troca aprovada",
      `Você assumirá ${swap.assignment.function.name} em ${swap.assignment.event.name}.${availability === "UNAVAILABLE" ? " Atenção: você informou indisponibilidade nesse horário." : ""}`,
      "/midia/minha-escala",
    ),
  ]);

  await audit({
    organizationId,
    userId: leaderUserId,
    action: "MEDIA_SWAP_APPROVED",
    entityType: "MediaSwapRequest",
    entityId: swapId,
    metadata: { assignmentId: swap.assignmentId, previousMemberId: swap.requestedByMemberId, newMemberId: swap.targetMemberId },
  });

  return { success: "Troca aprovada." };
}
