import { CalendarClock } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaAdesfSchedulesPage() {
  await requirePermission(permKey("MEDIA_ADESF", "VIEW"));
  return (
    <div>
      <PageHeader title="Escalas" description="Montagem e gestão de escalas da equipe de mídia." />
      <EmptyState
        icon={<CalendarClock size={28} />}
        title="Disponível na próxima etapa"
        description="O motor de escalas, geração automática por IA e confirmação de presença são objeto de uma fase futura do Mídia ADESF."
      />
    </div>
  );
}
