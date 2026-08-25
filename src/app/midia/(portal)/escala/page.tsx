import { CalendarClock } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaPortalGeneralSchedulePage() {
  await requireMediaMember();
  return (
    <div>
      <PageHeader title="Escala Geral" description="Escala completa da equipe de mídia." />
      <EmptyState
        icon={<CalendarClock size={28} />}
        title="Esta funcionalidade será disponibilizada na próxima etapa."
        description="O motor de escalas será implementado numa fase futura do Mídia ADESF."
      />
    </div>
  );
}
