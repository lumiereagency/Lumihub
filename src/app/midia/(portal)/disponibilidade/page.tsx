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

  const [coverage, pendingSpecialEvents, activeRecurrences] = await Promise.all([
    getWeekdayCoverageStatus(member.id),
    getPendingSpecialEvents(user.organizationId, member.id),
    db.mediaEventRecurrence.findMany({
      where: { organizationId: user.organizationId, active: true },
      orderBy: { startTime: "asc" },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
  ]);

  // Um dia pode ter mais de uma recorrência ativa em tese; fica com a
  // primeira (mais cedo) — é só uma sugestão de horário, o membro sempre
  // pode ajustar antes de salvar.
  const defaultTimesByDay: Record<number, { startTime: string; endTime: string }> = {};
  for (const r of activeRecurrences) {
    if (defaultTimesByDay[r.dayOfWeek]) continue;
    const [h, m] = r.startTime.split(":").map(Number);
    const endMinutesTotal = h * 60 + m + 60;
    const fallbackEnd = `${String(Math.floor(endMinutesTotal / 60) % 24).padStart(2, "0")}:${String(endMinutesTotal % 60).padStart(2, "0")}`;
    defaultTimesByDay[r.dayOfWeek] = { startTime: r.startTime, endTime: r.endTime ?? fallbackEnd };
  }

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
          defaultTimesByDay={defaultTimesByDay}
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
