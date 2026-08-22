"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { taskSchema, TASK_STATUSES } from "@/lib/validation/tasks";
import type { ActionState } from "@/lib/actions/auth-actions";

function parseTaskForm(formData: FormData) {
  return taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    projectId: formData.get("projectId"),
    assigneeUserId: formData.get("assigneeUserId"),
    status: formData.get("status") || "A_FAZER",
    priority: formData.get("priority") || "MEDIA",
    dueDate: formData.get("dueDate"),
  });
}

function revalidateTaskPaths(projectId: string | null | undefined) {
  revalidatePath("/tarefas");
  if (projectId) revalidatePath(`/projetos/${projectId}`);
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("TASKS", "CREATE"));

  const parsed = parseTaskForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const task = await db.task.create({ data: { organizationId: user.organizationId, ...parsed.data } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TASK_CREATED",
    entityType: "Task",
    entityId: task.id,
  });

  revalidateTaskPaths(task.projectId);
  return { success: "Tarefa criada." };
}

export async function updateTaskAction(taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("TASKS", "EDIT"));

  const parsed = parseTaskForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const existing = await db.task.findFirst({ where: { id: taskId, organizationId: user.organizationId } });
  if (!existing) return { error: "Tarefa não encontrada." };

  await db.task.update({
    where: { id: taskId },
    data: { ...parsed.data, completedAt: parsed.data.status === "CONCLUIDA" ? new Date() : null },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "TASK_UPDATED",
    entityType: "Task",
    entityId: taskId,
  });

  revalidateTaskPaths(parsed.data.projectId ?? existing.projectId);
  return { success: "Tarefa atualizada." };
}

export async function updateTaskStatusAction(taskId: string, status: string) {
  const user = await requirePermission(permKey("TASKS", "EDIT"));

  if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) return;

  const task = await db.task.findFirst({ where: { id: taskId, organizationId: user.organizationId } });
  if (!task) return;

  await db.task.update({
    where: { id: taskId },
    data: {
      status: status as (typeof TASK_STATUSES)[number],
      completedAt: status === "CONCLUIDA" ? new Date() : null,
    },
  });

  revalidateTaskPaths(task.projectId);
}

export async function deleteTaskAction(taskId: string) {
  const user = await requirePermission(permKey("TASKS", "DELETE"));

  const task = await db.task.findFirst({ where: { id: taskId, organizationId: user.organizationId } });
  if (!task) return;

  await db.task.delete({ where: { id: taskId } });
  revalidateTaskPaths(task.projectId);
}
