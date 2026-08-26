import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

interface ServiceResult {
  error?: string;
  success?: string;
}

// Recusa ("não vou poder", pedido do usuário para a confirmação mensal por
// WhatsApp) — símetrico a confirmAttendance, mas nunca move o status da
// atribuição sozinho: quem decide se libera a vaga e busca substituto é a
// camada que chama isto (hoje: o link de confirmação), nunca esta função.
export async function declineAttendance(organizationId: string, actorUserId: string, assignmentId: string, memberId: string): Promise<ServiceResult> {
  const assignment = await db.mediaScheduleAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
  if (assignment.memberId !== memberId) return { error: "Esta atribuição não pertence a você." };

  await db.mediaAttendance.upsert({
    where: { assignmentId },
    create: { assignmentId, memberId, confirmationStatus: "DECLINED" },
    update: { confirmationStatus: "DECLINED", confirmedAt: null },
  });

  await audit({ organizationId, userId: actorUserId, action: "MEDIA_ATTENDANCE_DECLINED", entityType: "MediaScheduleAssignment", entityId: assignmentId });
  return { success: "Indisponibilidade registrada." };
}

// Confirmação (§40-41): "eu pretendo comparecer" — diferente de check-in.
export async function confirmAttendance(organizationId: string, actorUserId: string, assignmentId: string, memberId: string): Promise<ServiceResult> {
  const assignment = await db.mediaScheduleAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
  if (assignment.memberId !== memberId) return { error: "Esta atribuição não pertence a você." };

  await db.$transaction(async (tx) => {
    await tx.mediaAttendance.upsert({
      where: { assignmentId },
      create: { assignmentId, memberId, confirmationStatus: "CONFIRMED", confirmedAt: new Date() },
      update: { confirmationStatus: "CONFIRMED", confirmedAt: new Date() },
    });
    if (assignment.status === "ASSIGNED") {
      await tx.mediaScheduleAssignment.update({ where: { id: assignmentId }, data: { status: "CONFIRMED" } });
    }
  });

  await audit({ organizationId, userId: actorUserId, action: "MEDIA_ATTENDANCE_CONFIRMED", entityType: "MediaScheduleAssignment", entityId: assignmentId });
  return { success: "Presença confirmada." };
}

// Check-in (§66-68): "eu cheguei" — só no dia do evento, sem geolocalização.
export async function checkInMember(organizationId: string, actorUserId: string, assignmentId: string, memberId: string): Promise<ServiceResult> {
  const assignment = await db.mediaScheduleAssignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { event: true } });
  if (assignment.memberId !== memberId) return { error: "Esta atribuição não pertence a você." };

  const today = new Date();
  const sameDay =
    assignment.event.startAt.getFullYear() === today.getFullYear() &&
    assignment.event.startAt.getMonth() === today.getMonth() &&
    assignment.event.startAt.getDate() === today.getDate();
  if (!sameDay) return { error: "O check-in só fica disponível no dia do evento." };

  await db.mediaAttendance.upsert({
    where: { assignmentId },
    create: { assignmentId, memberId, checkinStatus: "CHECKED_IN", checkedInAt: new Date(), markedByUserId: actorUserId },
    update: { checkinStatus: "CHECKED_IN", checkedInAt: new Date(), markedByUserId: actorUserId },
  });

  await audit({ organizationId, userId: actorUserId, action: "MEDIA_CHECKIN", entityType: "MediaScheduleAssignment", entityId: assignmentId });
  return { success: "Check-in registrado." };
}
