import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { EventList } from "./event-list";

export default async function MediaAdesfEventsPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));

  const [events, allFunctions] = await Promise.all([
    db.mediaEvent.findMany({
      where: { organizationId: user.organizationId, status: { not: "ARCHIVED" } },
      include: { _count: { select: { requirements: true } } },
      orderBy: { startAt: "desc" },
      take: 200,
    }),
    db.mediaFunction.findMany({ where: { organizationId: user.organizationId, active: true }, orderBy: { displayOrder: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Cultos e Eventos" description="Cadastro de cultos e eventos cobertos pela equipe de mídia." />
      <EventList
        events={events.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          startAt: e.startAt.toISOString(),
          status: e.status,
          location: e.location,
          requirementsCount: e._count.requirements,
        }))}
        allFunctions={allFunctions.map((f) => ({ id: f.id, name: f.name }))}
      />
    </div>
  );
}
