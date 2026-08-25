import { Calendar } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaAdesfCalendarPage() {
  await requirePermission(permKey("MEDIA_ADESF", "VIEW"));
  return (
    <div>
      <PageHeader title="Calendário" description="Visão consolidada de cultos, eventos e escalas." />
      <EmptyState
        icon={<Calendar size={28} />}
        title="Disponível na próxima etapa"
        description="O calendário consolidado será implementado numa fase futura do Mídia ADESF."
      />
    </div>
  );
}
