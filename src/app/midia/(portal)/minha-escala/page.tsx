import { CalendarClock } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AssignmentCard, type AssignmentCardData } from "@/components/media/assignment-card";

export default async function MediaPortalMyScalePage() {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const assignments = await db.mediaScheduleAssignment.findMany({
    where: { memberId: member.id, schedule: { status: "PUBLISHED" } },
    include: { event: true, function: true, attendance: true },
    orderBy: { event: { startAt: "desc" } },
  });

  const now = new Date();
  const toCard = (a: (typeof assignments)[number]): AssignmentCardData => ({
    assignmentId: a.id,
    eventName: a.event.name,
    startAt: a.event.startAt.toISOString(),
    location: a.event.location,
    functionName: a.function.name,
    confirmationStatus: a.attendance?.confirmationStatus ?? "PENDING",
    checkinStatus: a.attendance?.checkinStatus ?? "PENDING",
    isPast: a.event.startAt < now,
  });

  const future = assignments.filter((a) => a.event.startAt >= now).sort((a, b) => a.event.startAt.getTime() - b.event.startAt.getTime());
  const past = assignments.filter((a) => a.event.startAt < now);

  const [next, ...upcoming] = future;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Minha Escala" description="Suas responsabilidades na equipe de mídia." />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Próxima escala</h2>
        {next ? <AssignmentCard data={toCard(next)} /> : <EmptyState icon={<CalendarClock size={24} />} title="Nenhuma escala publicada ainda" />}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Próximas</h2>
          <div className="flex flex-col gap-3">
            {upcoming.map((a) => (
              <AssignmentCard key={a.id} data={toCard(a)} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Anteriores</h2>
          <div className="flex flex-col gap-3">
            {past.slice(0, 20).map((a) => (
              <AssignmentCard key={a.id} data={toCard(a)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
