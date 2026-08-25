import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getEventCoverage, validateScheduleForPublication } from "@/lib/media/schedule/schedule-service";
import { MEDIA_SCHEDULE_STATUS_LABELS, MEDIA_SCHEDULE_STATUS_TONE } from "@/lib/media/labels";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarClock } from "lucide-react";
import { ScheduleFillView, type ScheduleEventData } from "./schedule-fill-view";
import { PublishSchedulePanel } from "./publish-panel";

export default async function MediaAdesfScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));
  const { id } = await params;

  const schedule = await db.mediaSchedule.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!schedule) notFound();

  const events = await db.mediaEvent.findMany({
    where: { organizationId: user.organizationId, startAt: { gte: schedule.periodStart, lte: schedule.periodEnd }, status: { notIn: ["CANCELLED", "ARCHIVED"] } },
    include: {
      requirements: { include: { function: true } },
      assignments: { where: { scheduleId: id }, include: { member: { include: { user: { select: { name: true, avatarUrl: true } } } } } },
    },
    orderBy: { startAt: "asc" },
  });

  const eventData: ScheduleEventData[] = [];
  for (const event of events) {
    const coverage = event.requirements.length > 0 ? await getEventCoverage(event.id) : null;
    eventData.push({
      eventId: event.id,
      name: event.name,
      startAt: event.startAt.toISOString(),
      location: event.location,
      coverageStatus: coverage?.status ?? null,
      slots: event.requirements.flatMap((req) =>
        Array.from({ length: req.requiredQuantity }, (_, slotIndex) => {
          const assignment = event.assignments.find((a) => a.functionId === req.functionId && a.slotIndex === slotIndex);
          return {
            functionId: req.functionId,
            functionName: req.function.name,
            slotIndex,
            mandatory: req.mandatory,
            memberId: assignment?.memberId ?? null,
            memberName: assignment?.member?.user.name ?? null,
            memberAvatarUrl: assignment?.member?.user.avatarUrl ?? null,
            assignmentStatus: assignment?.status ?? "UNASSIGNED",
          };
        }),
      ),
    });
  }

  const validation = schedule.status === "DRAFT" || schedule.status === "REVIEW" ? await validateScheduleForPublication(id) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={schedule.name}
        description={`${formatDateTime(schedule.periodStart)} — ${formatDateTime(schedule.periodEnd)}`}
        actions={<Badge tone={MEDIA_SCHEDULE_STATUS_TONE[schedule.status]}>{MEDIA_SCHEDULE_STATUS_LABELS[schedule.status]}</Badge>}
      />

      {validation && <PublishSchedulePanel scheduleId={schedule.id} validation={validation} />}

      {eventData.length === 0 ? (
        <EmptyState icon={<CalendarClock size={28} />} title="Nenhum culto/evento neste período" />
      ) : (
        <ScheduleFillView scheduleId={schedule.id} events={eventData} editable={schedule.status !== "ARCHIVED"} />
      )}
    </div>
  );
}
