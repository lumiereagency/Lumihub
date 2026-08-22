"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { projectSchema, projectTeamMemberSchema, PROJECT_STATUSES } from "@/lib/validation/projects";
import type { ActionState } from "@/lib/actions/auth-actions";
import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

// Projeto → Agenda (Fase 26): mantém um evento de entrega sincronizado no
// calendário sempre que o projeto tiver um prazo definido.
async function syncProjectDeliveryEvent(tx: TxClient, projectId: string) {
  const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
  const existing = await tx.calendarEvent.findFirst({ where: { projectId, type: "ENTREGA" } });

  if (!project.dueDate) {
    if (existing) await tx.calendarEvent.delete({ where: { id: existing.id } });
    return;
  }

  if (existing) {
    await tx.calendarEvent.update({
      where: { id: existing.id },
      data: { title: `Entrega — ${project.name}`, startAt: project.dueDate, clientId: project.clientId },
    });
  } else {
    await tx.calendarEvent.create({
      data: {
        organizationId: project.organizationId,
        title: `Entrega — ${project.name}`,
        type: "ENTREGA",
        startAt: project.dueDate,
        clientId: project.clientId,
        projectId: project.id,
        responsibleUserId: project.responsibleUserId,
      },
    });
  }
}

function parseProjectForm(formData: FormData) {
  return projectSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    responsibleUserId: formData.get("responsibleUserId"),
    status: formData.get("status") || "BACKLOG",
    startDate: formData.get("startDate"),
    dueDate: formData.get("dueDate"),
    value: formData.get("value"),
    costEstimate: formData.get("costEstimate"),
  });
}

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("PROJECTS", "CREATE"));

  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const client = await db.client.findFirst({ where: { id: parsed.data.clientId, organizationId: user.organizationId } });
  if (!client) return { error: "Cliente não encontrado." };

  const project = await db.$transaction(async (tx) => {
    const created = await tx.project.create({ data: { organizationId: user.organizationId, ...parsed.data } });
    await syncProjectDeliveryEvent(tx, created.id);
    return created;
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PROJECT_CREATED",
    entityType: "Project",
    entityId: project.id,
    metadata: { name: project.name, clientId: project.clientId },
  });

  revalidatePath("/projetos");
  revalidatePath(`/clientes/${project.clientId}`);
  return { success: "Projeto criado." };
}

export async function updateProjectAction(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("PROJECTS", "EDIT"));

  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const existing = await db.project.findFirst({ where: { id: projectId, organizationId: user.organizationId } });
  if (!existing) return { error: "Projeto não encontrado." };

  const client = await db.client.findFirst({ where: { id: parsed.data.clientId, organizationId: user.organizationId } });
  if (!client) return { error: "Cliente não encontrado." };

  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: parsed.data });
    await syncProjectDeliveryEvent(tx, projectId);
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PROJECT_UPDATED",
    entityType: "Project",
    entityId: projectId,
  });

  revalidatePath("/projetos");
  revalidatePath(`/projetos/${projectId}`);
  revalidatePath(`/clientes/${parsed.data.clientId}`);
  return { success: "Projeto atualizado." };
}

export async function updateProjectStatusAction(projectId: string, status: string) {
  const user = await requirePermission(permKey("PROJECTS", "EDIT"));

  if (!PROJECT_STATUSES.includes(status as (typeof PROJECT_STATUSES)[number])) return;

  const project = await db.project.findFirst({ where: { id: projectId, organizationId: user.organizationId } });
  if (!project) return;

  await db.project.update({
    where: { id: projectId },
    data: { status: status as (typeof PROJECT_STATUSES)[number] },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PROJECT_STATUS_CHANGED",
    entityType: "Project",
    entityId: projectId,
    metadata: { from: project.status, to: status },
  });

  revalidatePath("/projetos");
  revalidatePath(`/projetos/${projectId}`);
}

export async function addProjectTeamMemberAction(projectId: string, formData: FormData) {
  const user = await requirePermission(permKey("PROJECTS", "EDIT"));

  const parsed = projectTeamMemberSchema.safeParse({
    teamMemberId: formData.get("teamMemberId"),
    roleInProject: formData.get("roleInProject"),
    costAllocated: formData.get("costAllocated"),
  });
  if (!parsed.success) return;

  const project = await db.project.findFirst({ where: { id: projectId, organizationId: user.organizationId } });
  if (!project) return;

  await db.projectTeamMember.upsert({
    where: { projectId_teamMemberId: { projectId, teamMemberId: parsed.data.teamMemberId } },
    create: { projectId, ...parsed.data },
    update: { roleInProject: parsed.data.roleInProject, costAllocated: parsed.data.costAllocated },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PROJECT_TEAM_MEMBER_ADDED",
    entityType: "Project",
    entityId: projectId,
    metadata: { teamMemberId: parsed.data.teamMemberId },
  });

  revalidatePath(`/projetos/${projectId}`);
}

export async function removeProjectTeamMemberAction(projectId: string, teamMemberId: string) {
  const user = await requirePermission(permKey("PROJECTS", "EDIT"));

  const project = await db.project.findFirst({ where: { id: projectId, organizationId: user.organizationId } });
  if (!project) return;

  await db.projectTeamMember.deleteMany({ where: { projectId, teamMemberId } });

  revalidatePath(`/projetos/${projectId}`);
}
