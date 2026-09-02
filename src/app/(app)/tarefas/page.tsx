import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { PROJECT_TABS, filterTabsForUser } from "@/lib/nav";
import { TaskBoard } from "./task-board";

export default async function TasksPage() {
  const user = await requirePermission(permKey("TASKS", "VIEW"));

  const [tasks, projects, users] = await Promise.all([
    db.task.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
    }),
    db.project.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("TASKS", "CREATE")),
    canEdit: hasPermission(user, permKey("TASKS", "EDIT")),
    canDelete: hasPermission(user, permKey("TASKS", "DELETE")),
  };

  return (
    <div>
      <PageHeader title="Tarefas" description="Tarefas por projeto, responsável e prioridade." />
      <SectionTabs tabs={filterTabsForUser(PROJECT_TABS, user.permissions)} />
      <TaskBoard
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          projectId: t.projectId,
          projectName: t.project?.name ?? null,
          assigneeUserId: t.assigneeUserId,
          assigneeName: t.assignee?.name ?? null,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() ?? null,
        }))}
        projects={projects}
        users={users}
        permissions={permissions}
      />
    </div>
  );
}
