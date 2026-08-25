import { History } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaAdesfHistoryPage() {
  await requirePermission(permKey("MEDIA_ADESF", "VIEW"));
  return (
    <div>
      <PageHeader title="Histórico" description="Histórico de escalas, participações e relatórios da equipe." />
      <EmptyState
        icon={<History size={28} />}
        title="Disponível na próxima etapa"
        description="Relatórios avançados e histórico consolidado serão implementados numa fase futura do Mídia ADESF."
      />
    </div>
  );
}
