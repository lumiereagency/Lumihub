import { CalendarDays } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaPortalCalendarPage() {
  await requireMediaMember();
  return (
    <div>
      <PageHeader title="Calendário" description="Cultos e eventos da equipe de mídia." />
      <EmptyState
        icon={<CalendarDays size={28} />}
        title="Disponível na próxima etapa"
        description="O calendário de cultos e eventos será implementado numa fase futura do Mídia ADESF."
      />
    </div>
  );
}
