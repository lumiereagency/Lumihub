import { CalendarClock } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaPortalMyScalePage() {
  await requireMediaMember();
  return (
    <div>
      <PageHeader title="Minha Escala" description="Suas próximas escalas confirmadas." />
      <EmptyState
        icon={<CalendarClock size={28} />}
        title="Disponível na próxima etapa"
        description="O motor de escalas, confirmação de presença e check-in serão implementados numa fase futura do Mídia ADESF."
      />
    </div>
  );
}
