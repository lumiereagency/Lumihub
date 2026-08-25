import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { MEDIA_SCHEDULE_STATUS_LABELS, MEDIA_SCHEDULE_STATUS_TONE } from "@/lib/media/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateScheduleButton } from "./create-schedule-form";

export default async function MediaAdesfSchedulesPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));

  const schedules = await db.mediaSchedule.findMany({
    where: { organizationId: user.organizationId },
    include: { _count: { select: { assignments: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return (
    <div>
      <PageHeader title="Escalas" description="Montagem e publicação das escalas mensais da equipe de mídia." actions={<CreateScheduleButton />} />

      {schedules.length === 0 ? (
        <EmptyState icon={<CalendarClock size={28} />} title="Nenhuma escala criada ainda" />
      ) : (
        <div className="flex flex-col gap-2">
          {schedules.map((s) => (
            <Link
              key={s.id}
              href={`/midia-adesf/escalas/${s.id}`}
              className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-4 py-3 hover:bg-card-elevated"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{s.name}</p>
                <p className="text-xs text-text-tertiary">{s._count.assignments} atribuição(ões)</p>
              </div>
              <Badge tone={MEDIA_SCHEDULE_STATUS_TONE[s.status]}>{MEDIA_SCHEDULE_STATUS_LABELS[s.status]}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
