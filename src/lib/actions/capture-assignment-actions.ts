"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

// Aceite de escala (Fase 46): o membro de equipe atribuído responde direto
// no painel da própria conta — sem precisar de app nativo/push, só logar.
async function respond(assignmentId: string, status: "ACEITO" | "RECUSADO") {
  const user = await requireUser();

  const assignment = await db.captureAssignment.findFirst({
    where: { id: assignmentId, userId: user.id, organizationId: user.organizationId },
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

  revalidatePath("/dashboard");
  revalidatePath("/captacoes");
}

export async function acceptCaptureAssignmentAction(assignmentId: string) {
  await respond(assignmentId, "ACEITO");
}

export async function declineCaptureAssignmentAction(assignmentId: string) {
  await respond(assignmentId, "RECUSADO");
}
