import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { CalendarView } from "./calendar-view";

function sourceHrefFor(event: { type: string; projectId: string | null; contractId: string | null }): string | null {
  if (event.type === "ENTREGA" && event.projectId) return `/projetos/${event.projectId}`;
  if (event.type === "CAPTACAO") return "/captacoes";
  if (event.type === "CONTRATO" && event.contractId) return "/contratos";
  return null;
}

export default async function AgendaPage() {
  const user = await requirePermission(permKey("CALENDAR", "VIEW"));

  const [events, clients, projects, users] = await Promise.all([
    db.calendarEvent.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { startAt: "asc" },
      include: {
        client: { select: { companyName: true } },
        project: { select: { name: true } },
        responsible: { select: { name: true } },
      },
    }),
    db.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
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
    canCreate: hasPermission(user, permKey("CALENDAR", "CREATE")),
    canEdit: hasPermission(user, permKey("CALENDAR", "EDIT")),
    canDelete: hasPermission(user, permKey("CALENDAR", "DELETE")),
  };

  return (
    <div>
      <PageHeader title="Agenda" description="Calendário integrado de captações, reuniões, entregas, vencimentos e contratos." />
      <CalendarView
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt?.toISOString() ?? null,
          allDay: e.allDay,
          clientId: e.clientId,
          clientName: e.client?.companyName ?? null,
          projectId: e.projectId,
          projectName: e.project?.name ?? null,
          responsibleUserId: e.responsibleUserId,
          responsibleName: e.responsible?.name ?? null,
          location: e.location,
          notes: e.notes,
          sourceHref: sourceHrefFor(e),
        }))}
        clients={clients}
        projects={projects}
        users={users}
        permissions={permissions}
      />
    </div>
  );
}
