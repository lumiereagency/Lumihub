"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { captureSchema } from "@/lib/validation/captures";
import {
  CAPTURE_CREW_ROLES,
  CAPTURE_CREW_ROLE_LABELS,
  CAPTURE_CREW_FORM_FIELDS,
  type CaptureCrewRole,
} from "@/lib/validation/capture-assignments";
import type { ActionState } from "@/lib/actions/auth-actions";
import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

// Captação criada → evento no calendário (Fase 36, automação explícita do
// roadmap): mantém um CalendarEvent do tipo CAPTACAO sincronizado.
async function syncCaptureCalendarEvent(tx: TxClient, captureId: string) {
  const capture = await tx.capture.findUniqueOrThrow({ where: { id: captureId } });
  const existing = await tx.calendarEvent.findFirst({ where: { captureId } });
  const title = `Captação — ${capture.location ?? "local a definir"}`;

  if (existing) {
    await tx.calendarEvent.update({
      where: { id: existing.id },
      data: { title, startAt: capture.date, clientId: capture.clientId, projectId: capture.projectId, location: capture.location },
    });
  } else {
    await tx.calendarEvent.create({
      data: {
        organizationId: capture.organizationId,
        title,
        type: "CAPTACAO",
        startAt: capture.date,
        clientId: capture.clientId,
        projectId: capture.projectId,
        captureId: capture.id,
        location: capture.location,
      },
    });
  }
}

function parseCaptureForm(formData: FormData) {
  return captureSchema.safeParse({
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
    date: formData.get("date"),
    location: formData.get("location"),
    status: formData.get("status") || "PLANEJADA",
    videomaker: formData.get("videomaker"),
    photographer: formData.get("photographer"),
    storymaker: formData.get("storymaker"),
    droneOperator: formData.get("droneOperator"),
    videoCount: formData.get("videoCount"),
    photoCount: formData.get("photoCount"),
    scriptNotes: formData.get("scriptNotes"),
    equipment: formData.get("equipment"),
  });
}

function parseCrewAssignments(formData: FormData): { role: CaptureCrewRole; userId: string }[] {
  const result: { role: CaptureCrewRole; userId: string }[] = [];
  for (const role of CAPTURE_CREW_ROLES) {
    const userId = formData.get(CAPTURE_CREW_FORM_FIELDS[role].userField);
    if (typeof userId === "string" && userId.trim()) {
      result.push({ role, userId: userId.trim() });
    }
  }
  return result;
}

// Aceite de escala (Fase 46): quando um membro de equipe é vinculado a um
// papel da captação, gera (ou recria, se a pessoa mudou) uma pendência de
// aceite + notificação na tela inicial dela. Trocar a pessoa reinicia o
// aceite; remover a vinculação apaga a pendência.
async function syncCaptureAssignments(
  tx: TxClient,
  organizationId: string,
  captureId: string,
  desired: { role: CaptureCrewRole; userId: string }[],
) {
  const [existing, capture] = await Promise.all([
    tx.captureAssignment.findMany({ where: { captureId } }),
    tx.capture.findUniqueOrThrow({ where: { id: captureId } }),
  ]);

  for (const role of CAPTURE_CREW_ROLES) {
    const wanted = desired.find((d) => d.role === role);
    const current = existing.find((e) => e.role === role);

    if (!wanted) {
      if (current) await tx.captureAssignment.delete({ where: { id: current.id } });
      continue;
    }

    if (current && current.userId === wanted.userId) continue;
    if (current) await tx.captureAssignment.delete({ where: { id: current.id } });

    await tx.captureAssignment.create({
      data: { organizationId, captureId, userId: wanted.userId, role, status: "PENDENTE" },
    });

    await tx.notification.create({
      data: {
        organizationId,
        userId: wanted.userId,
        title: "Nova captação para aceitar",
        body: `Você foi escalado como ${CAPTURE_CREW_ROLE_LABELS[role]} para a captação de ${capture.date.toLocaleDateString("pt-BR")} às ${capture.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${capture.location ? ` — ${capture.location}` : ""}. Aceite ou recuse na sua tela inicial.`,
        link: "/dashboard",
      },
    });
  }
}

export async function createCaptureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("CAPTURES", "CREATE"));

  const parsed = parseCaptureForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const client = await db.client.findFirst({ where: { id: parsed.data.clientId, organizationId: user.organizationId } });
  if (!client) return { error: "Cliente não encontrado." };

  const crewAssignments = parseCrewAssignments(formData);

  const capture = await db.$transaction(async (tx) => {
    const created = await tx.capture.create({ data: { organizationId: user.organizationId, ...parsed.data } });
    await syncCaptureCalendarEvent(tx, created.id);
    await syncCaptureAssignments(tx, user.organizationId, created.id, crewAssignments);
    return created;
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CAPTURE_CREATED",
    entityType: "Capture",
    entityId: capture.id,
  });

  revalidatePath("/captacoes");
  if (capture.projectId) revalidatePath(`/projetos/${capture.projectId}`);
  return { success: "Captação criada." };
}

export async function updateCaptureAction(
  captureId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("CAPTURES", "EDIT"));

  const parsed = parseCaptureForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const existing = await db.capture.findFirst({ where: { id: captureId, organizationId: user.organizationId } });
  if (!existing) return { error: "Captação não encontrada." };

  const client = await db.client.findFirst({ where: { id: parsed.data.clientId, organizationId: user.organizationId } });
  if (!client) return { error: "Cliente não encontrado." };

  const crewAssignments = parseCrewAssignments(formData);

  await db.$transaction(async (tx) => {
    await tx.capture.update({ where: { id: captureId }, data: parsed.data });
    await syncCaptureCalendarEvent(tx, captureId);
    await syncCaptureAssignments(tx, user.organizationId, captureId, crewAssignments);
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CAPTURE_UPDATED",
    entityType: "Capture",
    entityId: captureId,
  });

  revalidatePath("/captacoes");
  if (existing.projectId) revalidatePath(`/projetos/${existing.projectId}`);
  return { success: "Captação atualizada." };
}
