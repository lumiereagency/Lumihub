import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { ensureTaskBoards } from "@/lib/tasks/board-service";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { PROJECT_TABS, filterTabsForUser } from "@/lib/nav";
import { TaskWorkspace } from "./task-workspace";
import type { BoardTask } from "./task-ui";

export default async function TasksPage({ searchParams }: PageProps<"/tarefas">) {
  const user = await requirePermission(permKey("TASKS", "VIEW"));
  await ensureTaskBoards(user.organizationId, user.id);

  const params = await searchParams;
  const requestedBoard = typeof params.quadro === "string" ? params.quadro : null;
  const requestedCard = typeof params.cartao === "string" ? params.cartao : null;

  const boards = await db.taskBoard.findMany({
    where: { organizationId: user.organizationId, archivedAt: null },
    orderBy: { position: "asc" },
    include: {
      lists: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
      _count: { select: { tasks: { where: { archivedAt: null, status: { not: "CONCLUIDA" } } } } },
    },
  });

  let board = boards.find((b) => b.id === requestedBoard) ?? null;
  if (!board && requestedCard) {
    const card = await db.task.findFirst({ where: { id: requestedCard, organizationId: user.organizationId }, select: { boardId: true } });
    board = boards.find((b) => b.id === card?.boardId) ?? null;
  }
  board ??= boards[0];

  const [lists, tasks, labels, users, projects, clients, archived] = await Promise.all([
    db.taskList.findMany({ where: { boardId: board.id }, orderBy: { position: "asc" } }),
    db.task.findMany({
      where: { organizationId: user.organizationId, boardId: board.id, archivedAt: null, listId: { not: null } },
      orderBy: { position: "asc" },
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        project: { select: { id: true, name: true } },
        client: { select: { id: true, companyName: true } },
        labels: { select: { labelId: true } },
        members: { select: { userId: true } },
        checklist: { select: { done: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    }),
    db.taskLabel.findMany({ where: { boardId: board.id }, orderBy: { createdAt: "asc" } }),
    db.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    db.task.findMany({
      where: { organizationId: user.organizationId, boardId: board.id, archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      take: 50,
      select: { id: true, title: true, archivedAt: true, list: { select: { name: true } } },
    }),
  ]);

  const boardTasks: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    listId: t.listId!,
    position: t.position,
    status: t.status,
    priority: t.priority,
    coverColor: t.coverColor,
    coverUrl: t.coverAttachmentId ? `/api/workspace/arquivos/${t.coverAttachmentId}` : null,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    assignee: t.assignee,
    memberIds: t.members.map((m) => m.userId),
    labelIds: t.labels.map((l) => l.labelId),
    project: t.project,
    client: t.client,
    checklistDone: t.checklist.filter((c) => c.done).length,
    checklistTotal: t.checklist.length,
    commentCount: t._count.comments,
    attachmentCount: t._count.attachments,
  }));

  const permissions = {
    canCreate: hasPermission(user, permKey("TASKS", "CREATE")),
    canEdit: hasPermission(user, permKey("TASKS", "EDIT")),
    canDelete: hasPermission(user, permKey("TASKS", "DELETE")),
  };

  return (
    <div>
      <PageHeader title="Workspace" description="O espaço de trabalho da equipe: briefings, ideias e tarefas em quadros, com arquivos, links e conversa em cada cartão — todo mundo junto, ao mesmo tempo." />
      <SectionTabs tabs={filterTabsForUser(PROJECT_TABS, user.permissions)} />
      <TaskWorkspace
        key={board.id}
        board={{ id: board.id, name: board.name, color: board.color, description: board.description }}
        boards={boards.map((b) => ({ id: b.id, name: b.name, color: b.color, openCount: b._count.tasks, firstListId: b.lists[0]?.id ?? null }))}
        lists={lists.map((l) => ({ id: l.id, name: l.name, status: l.status, position: l.position }))}
        tasks={boardTasks}
        labels={labels.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
        users={users}
        projects={projects}
        clients={clients}
        archived={archived.map((a) => ({ id: a.id, title: a.title, listName: a.list?.name ?? null, archivedAt: a.archivedAt!.toISOString() }))}
        permissions={permissions}
        currentUserId={user.id}
        initialTaskId={requestedCard && boardTasks.some((t) => t.id === requestedCard) ? requestedCard : null}
        now={new Date().getTime()}
      />
    </div>
  );
}
