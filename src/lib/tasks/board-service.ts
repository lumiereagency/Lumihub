import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { TaskStatus } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient | typeof db;

export const POSITION_STEP = 1024;

const DEFAULT_LISTS: { name: string; status: TaskStatus }[] = [
  { name: "A fazer", status: "A_FAZER" },
  { name: "Em andamento", status: "EM_ANDAMENTO" },
  { name: "Em revisão", status: "EM_REVISAO" },
  { name: "Concluído", status: "CONCLUIDA" },
];

const DEFAULT_LABELS = [
  { name: "Urgente", color: "rose" },
  { name: "Cliente", color: "blue" },
  { name: "Social media", color: "violet" },
  { name: "Design", color: "teal" },
  { name: "Vídeo", color: "orange" },
  { name: "Interno", color: "slate" },
];

export async function createBoardWithDefaults(
  tx: Tx,
  input: { organizationId: string; name: string; color: string; createdByUserId: string | null; position: number },
) {
  return tx.taskBoard.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      color: input.color,
      position: input.position,
      createdByUserId: input.createdByUserId,
      lists: { create: DEFAULT_LISTS.map((l, i) => ({ ...l, position: (i + 1) * POSITION_STEP })) },
      labels: { create: DEFAULT_LABELS },
    },
  });
}

// Garante que exista ao menos um quadro e encaixa nele tarefas criadas fora
// do quadro (ex: pela página de um projeto) na lista do status correspondente.
export async function ensureTaskBoards(organizationId: string, userId: string | null) {
  let boards = await db.taskBoard.findMany({
    where: { organizationId, archivedAt: null },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  if (boards.length === 0) {
    const board = await createBoardWithDefaults(db, {
      organizationId,
      name: "Quadro geral",
      color: "orange",
      createdByUserId: userId,
      position: POSITION_STEP,
    });
    boards = [{ id: board.id }];
  }

  const orphans = await db.task.findMany({
    where: { organizationId, OR: [{ boardId: null }, { listId: null }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, boardId: true },
  });
  if (orphans.length === 0) return;

  for (const task of orphans) {
    const boardId = task.boardId ?? boards[0].id;
    const list = await listForStatus(db, boardId, task.status);
    if (!list) continue;
    await db.task.update({
      where: { id: task.id },
      data: { boardId, listId: list.id, position: await nextPosition(db, list.id) },
    });
  }
}

export async function listForStatus(tx: Tx, boardId: string, status: TaskStatus) {
  return (
    (await tx.taskList.findFirst({ where: { boardId, status }, orderBy: { position: "asc" } })) ??
    (await tx.taskList.findFirst({ where: { boardId }, orderBy: { position: "asc" } }))
  );
}

export async function nextPosition(tx: Tx, listId: string) {
  const last = await tx.task.findFirst({ where: { listId }, orderBy: { position: "desc" }, select: { position: true } });
  return (last?.position ?? 0) + POSITION_STEP;
}

export function completionFor(status: TaskStatus, previous: Date | null): Date | null {
  if (status !== "CONCLUIDA") return null;
  return previous ?? new Date();
}

// Mantém o cartão na coluna certa quando o status muda fora do quadro
// (ex: na página do projeto) e encaixa tarefas novas no primeiro quadro.
export async function syncTaskPlacement(taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId }, include: { list: true } });
  if (!task) return;

  let boardId = task.boardId;
  if (!boardId) {
    const board = await db.taskBoard.findFirst({
      where: { organizationId: task.organizationId, archivedAt: null },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (!board) return;
    boardId = board.id;
  }
  if (task.boardId === boardId && task.list && task.list.status === task.status) return;

  const list = await listForStatus(db, boardId, task.status);
  if (!list) return;
  await db.task.update({ where: { id: taskId }, data: { boardId, listId: list.id, position: await nextPosition(db, list.id) } });
}
