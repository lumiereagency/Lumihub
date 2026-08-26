import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { getWeekdayCoverageStatus, getPendingSpecialEvents } from "@/lib/media/schedule/availability-service";
import { WeeklyAvailabilityForm, AvailabilityExceptionsPanel, WeekdayCoverageBanner, PendingSpecialEventsPanel } from "./availability-form";

export default async function MediaPortalAvailabilityPage() {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      availabilityRecurring: true,
      availabilityExceptions: { where: { date: { gte: new Date() } }, orderBy: { date: "asc" } },
    },
  });

  const [coverage, pendingSpecialEvents] = await Promise.all([
    getWeekdayCoverageStatus(member.id),
    getPendingSpecialEvents(user.organizationId, member.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title="Disponibilidade semanal" description="Informe os dias e horários em que você costuma estar disponível." />
        <WeekdayCoverageBanner satisfied={coverage.satisfied} monthLabel={coverage.monthLabel} />
        <WeeklyAvailabilityForm
          initialSlots={member.availabilityRecurring.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            available: s.available,
          }))}
        />
      </div>

      {pendingSpecialEvents.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Cultos e eventos especiais</h2>
          <p className="mb-3 -mt-2 text-sm text-text-secondary">
            Festividades e congressos não seguem a grade semanal — diga se você vai estar disponível para cada um.
          </p>
          <PendingSpecialEventsPanel
            events={pendingSpecialEvents.map((e) => ({
              eventId: e.eventId,
              name: e.name,
              startAt: e.startAt.toISOString(),
              location: e.location,
            }))}
          />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Exceções (datas específicas)</h2>
        <AvailabilityExceptionsPanel
          exceptions={member.availabilityExceptions.map((e) => ({
            id: e.id,
            date: e.date.toISOString(),
            startTime: e.startTime,
            endTime: e.endTime,
            available: e.available,
            reason: e.reason,
          }))}
        />
      </div>
    </div>
  );
}
