"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { createGoogleCalendarReminder } from "@/lib/integrations/google-calendar";

const CAPTURE_DURATION_MS = 2 * 60 * 60 * 1000; // sem hora de término cadastrada — 2h de estimativa

// Aceite de escala (Fase 46): o membro de equipe atribuído responde direto
// no painel da própria conta — sem precisar de app nativo/push, só logar.
async function respond(assignmentId: string, status: "ACEITO" | "RECUSADO") {
  const user = await requireUser();

  const assignment = await db.captureAssignment.findFirst({
    where: { id: assignmentId, userId: user.id, organizationId: user.organizationId },
    include: { capture: { include: { client: { select: { companyName: true } } } } },
  });
  if (!assignment) return;
  if (assignment.status !== "PENDENTE") return;

  await db.captureAssignment.update({
    where: { id: assignmentId },
    data: { status, respondedAt: new Date() },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: status === "ACEITO" ? "CAPTURE_ASSIGNMENT_ACCEPTED" : "CAPTURE_ASSIGNMENT_DECLINED",
    entityType: "CaptureAssignment",
    entityId: assignmentId,
  });

  // Lembrete no Google Calendar de quem aceitou (§ pedido do usuário) — só
  // dispara na aceitação, nunca na recusa; falha de calendário nunca desfaz
  // o aceite já registrado.
  if (status === "ACEITO") {
    const result = await createGoogleCalendarReminder({
      organizationId: user.organizationId,
      title: `Captação — ${assignment.capture.client.companyName}`,
      description: `Função: ${assignment.role}`,
      location: assignment.capture.location,
      startAt: assignment.capture.date,
      endAt: new Date(assignment.capture.date.getTime() + CAPTURE_DURATION_MS),
      attendeeEmail: user.email,
      attendeeName: user.name,
    });
    if (result.eventId) {
      await db.captureAssignment.update({ where: { id: assignmentId }, data: { googleEventId: result.eventId } });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/captacoes");
}

export async function acceptCaptureAssignmentAction(assignmentId: string) {
  await respond(assignmentId, "ACEITO");
}

export async function declineCaptureAssignmentAction(assignmentId: string) {
  await respond(assignmentId, "RECUSADO");
}
