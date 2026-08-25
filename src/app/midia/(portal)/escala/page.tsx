import { CalendarClock } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/format";

export default async function MediaPortalGeneralSchedulePage() {
  const user = await requireMediaMember();

  const schedule = await db.mediaSchedule.findFirst({
    where: { organizationId: user.organizationId, status: "PUBLISHED", periodEnd: { gte: new Date() } },
    orderBy: { periodStart: "asc" },
  });

  if (!schedule) {
    return (
      <div>
        <PageHeader title="Escala Geral" description="Escala completa da equipe de mídia." />
        <EmptyState icon={<CalendarClock size={28} />} title="Nenhuma escala publicada no momento" />
      </div>
    );
  }

  const events = await db.mediaEvent.findMany({
    where: { organizationId: user.organizationId, startAt: { gte: schedule.periodStart, lte: schedule.periodEnd }, status: { notIn: ["CANCELLED", "ARCHIVED"] } },
    include: { assignments: { where: { scheduleId: schedule.id, memberId: { not: null } }, include: { function: true, member: { include: { user: { select: { name: true, avatarUrl: true } } } } } } },
    orderBy: { startAt: "asc" },
  });

  return (
    <div>
      <PageHeader title="Escala Geral" description={schedule.name} />
      <div className="flex flex-col gap-4">
        {events.map((event) => (
          <div key={event.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-medium text-text-primary">{event.name}</p>
            <p className="mb-3 text-xs text-text-tertiary">
              {formatDateTime(event.startAt)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
            {event.assignments.length === 0 ? (
              <p className="text-sm text-text-tertiary">Nenhuma vaga preenchida.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {event.assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <Avatar name={a.member!.user.name} src={a.member!.user.avatarUrl} size="sm" />
                    <span className="text-text-primary">{a.member!.user.name}</span>
                    <span className="text-text-tertiary">— {a.function.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
