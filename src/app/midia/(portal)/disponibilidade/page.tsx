import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { WeeklyAvailabilityForm, AvailabilityExceptionsPanel } from "./availability-form";

export default async function MediaPortalAvailabilityPage() {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      availabilityRecurring: true,
      availabilityExceptions: { where: { date: { gte: new Date() } }, orderBy: { date: "asc" } },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title="Disponibilidade semanal" description="Informe os dias e horários em que você costuma estar disponível." />
        <WeeklyAvailabilityForm
          initialSlots={member.availabilityRecurring.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            available: s.available,
          }))}
        />
      </div>

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
