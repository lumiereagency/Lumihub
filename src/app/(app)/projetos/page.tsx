import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectBoard } from "./project-board";

export default async function ProjectsPage() {
  const user = await requirePermission(permKey("PROJECTS", "VIEW"));

  const [projects, clients, users, organization] = await Promise.all([
    db.project.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, companyName: true } },
        responsible: { select: { id: true, name: true } },
        _count: { select: { tasks: true, team: true } },
      },
    }),
    db.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    db.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("PROJECTS", "CREATE")),
    canEdit: hasPermission(user, permKey("PROJECTS", "EDIT")),
  };

  return (
    <div>
      <PageHeader title="Projetos" description="Kanban de projetos por cliente, responsável e prazo." />
      <ProjectBoard
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          startDate: p.startDate?.toISOString() ?? null,
          dueDate: p.dueDate?.toISOString() ?? null,
          value: p.value ? Number(p.value) : null,
          costEstimate: p.costEstimate ? Number(p.costEstimate) : null,
          client: p.client,
          responsible: p.responsible,
          tasksCount: p._count.tasks,
          teamCount: p._count.team,
        }))}
        clients={clients}
        users={users}
        currency={organization.currency}
        permissions={permissions}
      />
    </div>
  );
}
