import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { MediaCalendarView } from "@/components/media/media-calendar-view";

export default async function MediaAdesfCalendarPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  const events = await db.mediaEvent.findMany({
    where: {
      organizationId: user.organizationId,
      status: { not: "ARCHIVED" },
      startAt: { gte: rangeStart, lte: rangeEnd },
    },
    orderBy: { startAt: "asc" },
  });

  return (
    <div>
      <PageHeader title="Calendário" description="Visão consolidada de cultos, eventos e escalas." />
      <MediaCalendarView
        events={events.map((e) => ({
          id: e.id,
          name: e.name,
          startAt: e.startAt.toISOString(),
          location: e.location,
          status: e.status,
          detailHref: `/midia-adesf/cultos/${e.id}`,
        }))}
        emptyMessage="Nenhum culto ou evento no período."
      />
    </div>
  );
}
