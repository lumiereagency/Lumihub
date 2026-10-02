"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/validation/tasks";
import { isTaskColor } from "@/lib/tasks/colors";
import {
  POSITION_STEP,
  completionFor,
  createBoardWithDefaults,
  nextPosition,
} from "@/lib/tasks/board-service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const VIEW = permKey("TASKS", "VIEW");
const CREATE = permKey("TASKS", "CREATE");
const EDIT = permKey("TASKS", "EDIT");
const DELETE = permKey("TASKS", "DELETE");

function done() {
  revalidatePath("/tarefas");
}

function cardLink(boardId: string | null, taskId: string) {
  return `/tarefas?quadro=${boardId ?? ""}&cartao=${taskId}`;
}

async function findTask(organizationId: string, taskId: string) {
  return db.task.findFirst({ where: { id: taskId, organizationId } });
}

async function findList(organizationId: string, listId: string) {
  return db.taskList.findFirst({ where: { id: listId, board: { organizationId } }, include: { board: true } });
}

async function findBoard(organizationId: string, boardId: string) {
  return db.taskBoard.findFirst({ where: { id: boardId, organizationId } });
}

async function notify(organizationId: string, userId: string, actorId: string, title: string, body: string, link: string) {
  if (userId === actorId) return;
  await db.notification.create({ data: { organizationId, userId, title, body, link } });
}

// ---------------------------------------------------------------- Quadros

export async function createBoardAction(name: string, color: string): Promise<Result<{ boardId: string }>> {
  const user = await requirePermission(CREATE);
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Dê um nome ao quadro." };

  const last = await db.taskBoard.findFirst({
    where: { organizationId: user.organizationId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const board = await createBoardWithDefaults(db, {
    organizationId: user.organizationId,
    name: trimmed.slice(0, 80),
    color: isTaskColor(color) ? color : "orange",
    createdByUserId: user.id,
    position: (last?.position ?? 0) + POSITION_STEP,
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "TASK_BOARD_CREATED", entityType: "TaskBoard", entityId: board.id, metadata: { name: board.name } });
  done();
  return { ok: true, boardId: board.id };
}

export async function updateBoardAction(boardId: string, patch: { name?: string; color?: string; description?: string | null }): Promise<Result> {
  const user = await requirePermission(EDIT);
  const board = await findBoard(user.organizationId, boardId);
  if (!board) return { ok: false, error: "Quadro não encontrado." };
  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) return { ok: false, error: "Dê um nome ao quadro." };

  await db.taskBoard.update({
    where: { id: boardId },
    data: {
      ...(name ? { name: name.slice(0, 80) } : {}),
      ...(patch.color && isTaskColor(patch.color) ? { color: patch.color } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
    },
  });
  done();
  return { ok: true };
}

export async function archiveBoardAction(boardId: string): Promise<Result> {
  const user = await requirePermission(DELETE);
  const board = await findBoard(user.organizationId, boardId);
  if (!board) return { ok: false, error: "Quadro não encontrado." };
  const remaining = await db.taskBoard.count({ where: { organizationId: user.organizationId, archivedAt: null, id: { not: boardId } } });
  if (remaining === 0) return { ok: false, error: "Esse é o único quadro — crie outro antes de arquivar." };

  await db.taskBoard.update({ where: { id: boardId }, data: { archivedAt: new Date() } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "TASK_BOARD_ARCHIVED", entityType: "TaskBoard", entityId: boardId, metadata: { name: board.name } });
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- Listas

export async function createListAction(boardId: string, name: string): Promise<Result<{ listId: string }>> {
  const user = await requirePermission(CREATE);
  const board = await findBoard(user.organizationId, boardId);
  if (!board) return { ok: false, error: "Quadro não encontrado." };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Dê um nome à lista." };

  const last = await db.taskList.findFirst({ where: { boardId }, orderBy: { position: "desc" }, select: { position: true } });
  const list = await db.taskList.create({
    data: { boardId, name: trimmed.slice(0, 60), position: (last?.position ?? 0) + POSITION_STEP },
  });
  done();
  return { ok: true, listId: list.id };
}

export async function updateListAction(listId: string, patch: { name?: string; status?: string }): Promise<Result> {
  const user = await requirePermission(EDIT);
  const list = await findList(user.organizationId, listId);
  if (!list) return { ok: false, error: "Lista não encontrada." };
  const name = patch.name?.trim();
  const status = TASK_STATUSES.find((s) => s === patch.status);

  await db.$transaction(async (tx) => {
    await tx.taskList.update({
      where: { id: listId },
      data: { ...(name ? { name: name.slice(0, 60) } : {}), ...(status ? { status } : {}) },
    });
    if (status && status !== list.status) {
      const tasks = await tx.task.findMany({ where: { listId }, select: { id: true, completedAt: true } });
      for (const t of tasks) {
        await tx.task.update({ where: { id: t.id }, data: { status, completedAt: completionFor(status, t.completedAt) } });
      }
    }
  });
  done();
  return { ok: true };
}

export async function moveListAction(listId: string, direction: -1 | 1): Promise<Result> {
  const user = await requirePermission(EDIT);
  const list = await findList(user.organizationId, listId);
  if (!list) return { ok: false, error: "Lista não encontrada." };

  const lists = await db.taskList.findMany({ where: { boardId: list.boardId }, orderBy: { position: "asc" } });
  const index = lists.findIndex((l) => l.id === listId);
  const neighbor = lists[index + direction];
  if (!neighbor) return { ok: true };

  await db.$transaction([
    db.taskList.update({ where: { id: list.id }, data: { position: neighbor.position } }),
    db.taskList.update({ where: { id: neighbor.id }, data: { position: list.position } }),
  ]);
  done();
  return { ok: true };
}

export async function deleteListAction(listId: string, moveCardsToListId: string | null): Promise<Result> {
  const user = await requirePermission(DELETE);
  const list = await findList(user.organizationId, listId);
  if (!list) return { ok: false, error: "Lista não encontrada." };

  const count = await db.task.count({ where: { listId } });
  if (count > 0) {
    if (!moveCardsToListId) return { ok: false, error: "Essa lista tem cartões — escolha para onde movê-los." };
    const target = await findList(user.organizationId, moveCardsToListId);
    if (!target || target.boardId !== list.boardId || target.id === list.id) return { ok: false, error: "Lista de destino inválida." };
    const tasks = await db.task.findMany({ where: { listId }, orderBy: { position: "asc" } });
    let position = await nextPosition(db, target.id);
    await db.$transaction(
      tasks.map((t) => {
        const data = { listId: target.id, position, status: target.status, completedAt: completionFor(target.status, t.completedAt) };
        position += POSITION_STEP;
        return db.task.update({ where: { id: t.id }, data });
      }),
    );
  }
  await db.taskList.delete({ where: { id: listId } });
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- Cartões

export async function quickCreateTaskAction(listId: string, title: string): Promise<Result<{ taskId: string }>> {
  const user = await requirePermission(CREATE);
  const list = await findList(user.organizationId, listId);
  if (!list) return { ok: false, error: "Lista não encontrada." };
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Escreva o título do cartão." };

  const task = await db.task.create({
    data: {
      organizationId: user.organizationId,
      boardId: list.boardId,
      listId,
      title: trimmed.slice(0, 200),
      status: list.status,
      completedAt: completionFor(list.status, null),
      position: await nextPosition(db, listId),
      createdByUserId: user.id,
    },
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "TASK_CREATED", entityType: "Task", entityId: task.id, metadata: { list: list.name } });
  done();
  return { ok: true, taskId: task.id };
}

export async function moveTaskAction(taskId: string, listId: string, position: number): Promise<Result> {
  const user = await requirePermission(EDIT);
  const task = await findTask(user.organizationId, taskId);
  const list = await findList(user.organizationId, listId);
  if (!task || !list) return { ok: false, error: "Cartão ou lista não encontrado." };
  if (!Number.isFinite(position)) return { ok: false, error: "Posição inválida." };
  const finalPosition = position < 0 ? await nextPosition(db, listId) : position;

  const changedBoard = task.boardId !== list.boardId;
  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        boardId: list.boardId,
        listId,
        position: finalPosition,
        status: list.status,
        completedAt: completionFor(list.status, task.completedAt),
      },
    });
    if (changedBoard) await tx.taskLabelAssignment.deleteMany({ where: { taskId } });
  });

  if (task.listId !== listId) {
    const from = task.listId ? await db.taskList.findUnique({ where: { id: task.listId }, select: { name: true } }) : null;
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "TASK_MOVED",
      entityType: "Task",
      entityId: taskId,
      metadata: { from: from?.name ?? null, to: list.name, board: changedBoard ? list.board.name : undefined },
    });
  }
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  done();
  return { ok: true };
}

export async function setTaskDoneAction(taskId: string, isDone: boolean): Promise<Result> {
  const user = await requirePermission(EDIT);
  const task = await findTask(user.organizationId, taskId);
  if (!task?.boardId) return { ok: false, error: "Cartão não encontrado." };

  const target = isDone
    ? await db.taskList.findFirst({ where: { boardId: task.boardId, status: "CONCLUIDA" }, orderBy: { position: "asc" } })
    : await db.taskList.findFirst({ where: { boardId: task.boardId, status: { not: "CONCLUIDA" } }, orderBy: { position: "asc" } });

  if (target) {
    return moveTaskAction(taskId, target.id, await nextPosition(db, target.id));
  }
  await db.task.update({
    where: { id: taskId },
    data: { status: isDone ? "CONCLUIDA" : "A_FAZER", completedAt: isDone ? new Date() : null },
  });
  done();
  return { ok: true };
}

const patchSchema = z.object({
  title: z.string().trim().min(1, "O título não pode ficar vazio.").max(200).optional(),
  description: z.string().max(20000).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  coverColor: z.string().nullable().optional(),
  assigneeUserId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
});

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function updateTaskFieldsAction(taskId: string, patch: z.input<typeof patchSchema>): Promise<Result> {
  const user = await requirePermission(EDIT);
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const task = await findTask(user.organizationId, taskId);
  if (!task) return { ok: false, error: "Cartão não encontrado." };
  const p = parsed.data;

  if (p.assigneeUserId) {
    const ok = await db.user.count({ where: { id: p.assigneeUserId, organizationId: user.organizationId } });
    if (!ok) return { ok: false, error: "Responsável inválido." };
  }
  if (p.projectId) {
    const ok = await db.project.count({ where: { id: p.projectId, organizationId: user.organizationId } });
    if (!ok) return { ok: false, error: "Projeto inválido." };
  }
  if (p.clientId) {
    const ok = await db.client.count({ where: { id: p.clientId, organizationId: user.organizationId } });
    if (!ok) return { ok: false, error: "Cliente inválido." };
  }

  await db.task.update({
    where: { id: taskId },
    data: {
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.description !== undefined ? { description: p.description?.trim() || null } : {}),
      ...(p.priority ? { priority: p.priority } : {}),
      ...(p.dueDate !== undefined ? { dueDate: parseDate(p.dueDate) } : {}),
      ...(p.startDate !== undefined ? { startDate: parseDate(p.startDate) } : {}),
      ...(p.coverColor !== undefined ? { coverColor: isTaskColor(p.coverColor) ? p.coverColor : null } : {}),
      ...(p.assigneeUserId !== undefined ? { assigneeUserId: p.assigneeUserId || null } : {}),
      ...(p.projectId !== undefined ? { projectId: p.projectId || null } : {}),
      ...(p.clientId !== undefined ? { clientId: p.clientId || null } : {}),
    },
  });

  const changed = Object.keys(p).filter((k) => p[k as keyof typeof p] !== undefined);
  await audit({ organizationId: user.organizationId, userId: user.id, action: "TASK_UPDATED", entityType: "Task", entityId: taskId, metadata: { fields: changed } });

  if (p.assigneeUserId && p.assigneeUserId !== task.assigneeUserId) {
    await notify(user.organizationId, p.assigneeUserId, user.id, "Nova tarefa para você", `${user.name} te colocou como responsável por "${task.title}".`, cardLink(task.boardId, taskId));
  }
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  if (p.projectId) revalidatePath(`/projetos/${p.projectId}`);
  done();
  return { ok: true };
}

export async function duplicateTaskAction(taskId: string): Promise<Result<{ taskId: string }>> {
  const user = await requirePermission(CREATE);
  const task = await db.task.findFirst({
    where: { id: taskId, organizationId: user.organizationId },
    include: { labels: true, members: true, checklist: { orderBy: { position: "asc" } } },
  });
  if (!task) return { ok: false, error: "Cartão não encontrado." };

  const copy = await db.task.create({
    data: {
      organizationId: task.organizationId,
      boardId: task.boardId,
      listId: task.listId,
      position: task.position + 1,
      projectId: task.projectId,
      clientId: task.clientId,
      title: `${task.title} (cópia)`.slice(0, 200),
      description: task.description,
      assigneeUserId: task.assigneeUserId,
      status: task.status,
      priority: task.priority,
      coverColor: task.coverColor,
      startDate: task.startDate,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      createdByUserId: user.id,
      labels: { create: task.labels.map((l) => ({ labelId: l.labelId })) },
      members: { create: task.members.map((m) => ({ userId: m.userId })) },
      checklist: { create: task.checklist.map((c) => ({ text: c.text, done: false, position: c.position })) },
    },
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "TASK_CREATED", entityType: "Task", entityId: copy.id, metadata: { copiedFrom: task.title } });
  done();
  return { ok: true, taskId: copy.id };
}

export async function archiveTaskAction(taskId: string, archived: boolean): Promise<Result> {
  const user = await requirePermission(EDIT);
  const task = await findTask(user.organizationId, taskId);
  if (!task) return { ok: false, error: "Cartão não encontrado." };
  await db.task.update({ where: { id: taskId }, data: { archivedAt: archived ? new Date() : null } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: archived ? "TASK_ARCHIVED" : "TASK_RESTORED", entityType: "Task", entityId: taskId });
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  done();
  return { ok: true };
}

export async function deleteTaskPermanentlyAction(taskId: string): Promise<Result> {
  const user = await requirePermission(DELETE);
  const task = await findTask(user.organizationId, taskId);
  if (!task) return { ok: false, error: "Cartão não encontrado." };
  await db.task.delete({ where: { id: taskId } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "TASK_DELETED", entityType: "Task", entityId: taskId, metadata: { title: task.title } });
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- Etiquetas e membros

export async function createLabelAction(boardId: string, name: string, color: string): Promise<Result<{ labelId: string }>> {
  const user = await requirePermission(EDIT);
  const board = await findBoard(user.organizationId, boardId);
  if (!board) return { ok: false, error: "Quadro não encontrado." };
  if (!isTaskColor(color)) return { ok: false, error: "Cor inválida." };
  const label = await db.taskLabel.create({ data: { boardId, name: name.trim().slice(0, 40), color } });
  done();
  return { ok: true, labelId: label.id };
}

export async function deleteLabelAction(labelId: string): Promise<Result> {
  const user = await requirePermission(EDIT);
  const label = await db.taskLabel.findFirst({ where: { id: labelId, board: { organizationId: user.organizationId } } });
  if (!label) return { ok: false, error: "Etiqueta não encontrada." };
  await db.taskLabel.delete({ where: { id: labelId } });
  done();
  return { ok: true };
}

export async function toggleTaskLabelAction(taskId: string, labelId: string): Promise<Result> {
  const user = await requirePermission(EDIT);
  const task = await findTask(user.organizationId, taskId);
  const label = await db.taskLabel.findFirst({ where: { id: labelId, board: { organizationId: user.organizationId } } });
  if (!task || !label || label.boardId !== task.boardId) return { ok: false, error: "Etiqueta inválida para esse cartão." };

  const existing = await db.taskLabelAssignment.findUnique({ where: { taskId_labelId: { taskId, labelId } } });
  if (existing) await db.taskLabelAssignment.delete({ where: { taskId_labelId: { taskId, labelId } } });
  else await db.taskLabelAssignment.create({ data: { taskId, labelId } });
  done();
  return { ok: true };
}

export async function toggleTaskMemberAction(taskId: string, userId: string): Promise<Result> {
  const user = await requirePermission(EDIT);
  const task = await findTask(user.organizationId, taskId);
  const member = await db.user.findFirst({ where: { id: userId, organizationId: user.organizationId }, select: { id: true } });
  if (!task || !member) return { ok: false, error: "Membro inválido." };

  const existing = await db.taskMember.findUnique({ where: { taskId_userId: { taskId, userId } } });
  if (existing) {
    await db.taskMember.delete({ where: { taskId_userId: { taskId, userId } } });
  } else {
    await db.taskMember.create({ data: { taskId, userId } });
    await notify(user.organizationId, userId, user.id, "Você foi adicionado a um cartão", `${user.name} te adicionou em "${task.title}".`, cardLink(task.boardId, taskId));
  }
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- Checklist

async function findItem(organizationId: string, itemId: string) {
  return db.taskChecklistItem.findFirst({ where: { id: itemId, task: { organizationId } } });
}

export async function addChecklistItemAction(taskId: string, text: string): Promise<Result> {
  const user = await requirePermission(EDIT);
  const task = await findTask(user.organizationId, taskId);
  const trimmed = text.trim();
  if (!task || !trimmed) return { ok: false, error: "Escreva o item." };
  const last = await db.taskChecklistItem.findFirst({ where: { taskId }, orderBy: { position: "desc" }, select: { position: true } });
  await db.taskChecklistItem.create({ data: { taskId, text: trimmed.slice(0, 300), position: (last?.position ?? 0) + POSITION_STEP } });
  done();
  return { ok: true };
}

export async function toggleChecklistItemAction(itemId: string): Promise<Result> {
  const user = await requirePermission(EDIT);
  const item = await findItem(user.organizationId, itemId);
  if (!item) return { ok: false, error: "Item não encontrado." };
  await db.taskChecklistItem.update({ where: { id: itemId }, data: { done: !item.done } });
  if (!item.done) {
    await audit({ organizationId: user.organizationId, userId: user.id, action: "TASK_CHECKLIST_DONE", entityType: "Task", entityId: item.taskId, metadata: { item: item.text } });
  }
  done();
  return { ok: true };
}

export async function updateChecklistItemAction(itemId: string, text: string): Promise<Result> {
  const user = await requirePermission(EDIT);
  const item = await findItem(user.organizationId, itemId);
  const trimmed = text.trim();
  if (!item || !trimmed) return { ok: false, error: "Item inválido." };
  await db.taskChecklistItem.update({ where: { id: itemId }, data: { text: trimmed.slice(0, 300) } });
  done();
  return { ok: true };
}

export async function deleteChecklistItemAction(itemId: string): Promise<Result> {
  const user = await requirePermission(EDIT);
  const item = await findItem(user.organizationId, itemId);
  if (!item) return { ok: false, error: "Item não encontrado." };
  await db.taskChecklistItem.delete({ where: { id: itemId } });
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- Comentários e links

export async function addTaskCommentAction(taskId: string, body: string): Promise<Result> {
  const user = await requirePermission(VIEW);
  const task = await db.task.findFirst({
    where: { id: taskId, organizationId: user.organizationId },
    include: { members: { select: { userId: true } } },
  });
  const trimmed = body.trim();
  if (!task || !trimmed) return { ok: false, error: "Escreva o comentário." };

  await db.taskComment.create({ data: { taskId, userId: user.id, body: trimmed.slice(0, 5000) } });
  const watchers = new Set([task.assigneeUserId, task.createdByUserId, ...task.members.map((m) => m.userId)].filter((id): id is string => !!id));
  for (const watcher of watchers) {
    await notify(user.organizationId, watcher, user.id, "Novo comentário", `${user.name} comentou em "${task.title}".`, cardLink(task.boardId, taskId));
  }
  done();
  return { ok: true };
}

export async function deleteTaskCommentAction(commentId: string): Promise<Result> {
  const user = await requirePermission(VIEW);
  const comment = await db.taskComment.findFirst({ where: { id: commentId, task: { organizationId: user.organizationId } } });
  if (!comment) return { ok: false, error: "Comentário não encontrado." };
  if (comment.userId !== user.id && !hasPermission(user, DELETE)) return { ok: false, error: "Você só pode apagar seus próprios comentários." };
  await db.taskComment.delete({ where: { id: commentId } });
  done();
  return { ok: true };
}

export async function addTaskAttachmentAction(taskId: string, name: string, url: string): Promise<Result> {
  const user = await requirePermission(EDIT);
  const task = await findTask(user.organizationId, taskId);
  if (!task) return { ok: false, error: "Cartão não encontrado." };
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { ok: false, error: "Cole um link válido (começando com https://)." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { ok: false, error: "O link precisa começar com https://." };

  await db.taskAttachment.create({
    data: { taskId, name: (name.trim() || parsed.hostname).slice(0, 120), url: parsed.toString(), createdByUserId: user.id },
  });
  done();
  return { ok: true };
}

export async function deleteTaskAttachmentAction(attachmentId: string): Promise<Result> {
  const user = await requirePermission(EDIT);
  const attachment = await db.taskAttachment.findFirst({ where: { id: attachmentId, task: { organizationId: user.organizationId } } });
  if (!attachment) return { ok: false, error: "Link não encontrado." };
  await db.taskAttachment.delete({ where: { id: attachmentId } });
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- Detalhes do cartão

export interface TaskDetails {
  id: string;
  description: string | null;
  createdAt: string;
  createdByName: string | null;
  checklist: { id: string; text: string; done: boolean }[];
  comments: { id: string; body: string; createdAt: string; userId: string | null; userName: string; avatarUrl: string | null }[];
  attachments: { id: string; name: string; url: string; createdAt: string }[];
  activity: { id: string; action: string; userName: string; createdAt: string; metadata: Record<string, unknown> }[];
}

export async function getTaskDetailsAction(taskId: string): Promise<TaskDetails | null> {
  const user = await requirePermission(VIEW);
  const task = await db.task.findFirst({
    where: { id: taskId, organizationId: user.organizationId },
    include: {
      createdBy: { select: { name: true } },
      checklist: { orderBy: { position: "asc" } },
      comments: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, avatarUrl: true } } } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!task) return null;

  const logs = await db.auditLog.findMany({
    where: { organizationId: user.organizationId, entityType: "Task", entityId: taskId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { name: true } } },
  });

  return {
    id: task.id,
    description: task.description,
    createdAt: task.createdAt.toISOString(),
    createdByName: task.createdBy?.name ?? null,
    checklist: task.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done })),
    comments: task.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      userId: c.userId,
      userName: c.user?.name ?? "Usuário removido",
      avatarUrl: c.user?.avatarUrl ?? null,
    })),
    attachments: task.attachments.map((a) => ({ id: a.id, name: a.name, url: a.url, createdAt: a.createdAt.toISOString() })),
    activity: logs.map((l) => ({
      id: l.id,
      action: l.action,
      userName: l.user?.name ?? "Sistema",
      createdAt: l.createdAt.toISOString(),
      metadata: (l.metadata ?? {}) as Record<string, unknown>,
    })),
  };
}
