import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectDetailHeader } from "./project-detail-header";
import { ProjectTeam } from "./project-team";
import { ProjectTasks } from "./project-tasks";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(permKey("PROJECTS", "VIEW"));

  const project = await db.project.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
    include: {
      client: { select: { id: true, companyName: true } },
      responsible: { select: { id: true, name: true } },
      tasks: { orderBy: { createdAt: "desc" }, include: { assignee: { select: { name: true } } } },
      team: { include: { teamMember: { select: { id: true, name: true, role: true } } } },
      captures: { orderBy: { date: "asc" } },
    },
  });
  if (!project) notFound();

  const [clients, users, teamMembers] = await Promise.all([
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
    db.teamMember.findMany({
      where: { organizationId: user.organizationId, active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const organization = await db.organization.findUniqueOrThrow({
    where: { id: user.organizationId },
    select: { currency: true },
  });
  const currency = organization.currency;

  const value = project.value ? Number(project.value) : 0;
  const costEstimate = project.costEstimate ? Number(project.costEstimate) : 0;
  const teamCost = project.team.reduce((sum, t) => sum + (t.costAllocated ? Number(t.costAllocated) : 0), 0);
  const margin = value - costEstimate - teamCost;

  const permissions = {
    canEdit: hasPermission(user, permKey("PROJECTS", "EDIT")),
    canCreateTasks: hasPermission(user, permKey("TASKS", "CREATE")),
    canEditTasks: hasPermission(user, permKey("TASKS", "EDIT")),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={project.name} />

      <ProjectDetailHeader
        project={{
          id: project.id,
          clientId: project.clientId,
          name: project.name,
          responsibleUserId: project.responsibleUserId,
          status: project.status,
          startDate: project.startDate?.toISOString() ?? null,
          dueDate: project.dueDate?.toISOString() ?? null,
          value: project.value ? Number(project.value) : null,
          costEstimate: project.costEstimate ? Number(project.costEstimate) : null,
          clientName: project.client.companyName,
          responsibleName: project.responsible?.name ?? null,
        }}
        clients={clients}
        users={users}
        permissions={permissions}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Valor" value={formatCurrency(value, currency)} tone="accent" />
        <MetricCard label="Custo estimado" value={formatCurrency(costEstimate, currency)} />
        <MetricCard label="Custo de equipe" value={formatCurrency(teamCost, currency)} />
        <MetricCard label="Margem" value={formatCurrency(margin, currency)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Equipe do projeto</CardTitle>
          </CardHeader>
          <ProjectTeam
            projectId={project.id}
            assigned={project.team.map((t) => ({
              teamMemberId: t.teamMemberId,
              name: t.teamMember.name,
              role: t.teamMember.role,
              roleInProject: t.roleInProject,
              costAllocated: t.costAllocated ? Number(t.costAllocated) : null,
            }))}
            availableMembers={teamMembers}
            currency={currency}
            canEdit={permissions.canEdit}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tarefas</CardTitle>
          </CardHeader>
          <ProjectTasks
            projectId={project.id}
            tasks={project.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              assigneeName: t.assignee?.name ?? null,
            }))}
            canCreate={permissions.canCreateTasks}
            canEdit={permissions.canEditTasks}
          />
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock size={16} className="text-text-tertiary" /> Captações
          </CardTitle>
        </CardHeader>
        {project.captures.length === 0 ? (
          <EmptyState title="Nenhuma captação vinculada a este projeto" description="Crie uma captação e associe a este projeto na tela de Captações." />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {project.captures.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-text-primary">{formatDate(c.date)}</span>
                <span className="text-text-tertiary">{c.location ?? "Local não informado"}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
