import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { MediaCalendarView } from "@/components/media/media-calendar-view";

export default async function MediaPortalCalendarPage() {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

  const [events, myAssignments] = await Promise.all([
    db.mediaEvent.findMany({
      where: { organizationId: user.organizationId, status: { notIn: ["CANCELLED", "ARCHIVED"] }, startAt: { gte: rangeStart, lte: rangeEnd } },
      orderBy: { startAt: "asc" },
    }),
    db.mediaScheduleAssignment.findMany({ where: { memberId: member.id, schedule: { status: "PUBLISHED" } }, select: { eventId: true } }),
  ]);
  const myEventIds = new Set(myAssignments.map((a) => a.eventId));

  return (
    <div>
      <PageHeader title="Calendário" description="Cultos e eventos da equipe de mídia." />
      <MediaCalendarView
        events={events.map((e) => ({
          id: e.id,
          name: e.name,
          startAt: e.startAt.toISOString(),
          location: e.location,
          status: e.status,
          detailHref: "/midia/escala",
          isMine: myEventIds.has(e.id),
        }))}
        emptyMessage="Nenhum culto ou evento no período."
      />
    </div>
  );
}
