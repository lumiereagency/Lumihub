import { Send } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaAdesfRequestsPage() {
  await requirePermission(permKey("MEDIA_ADESF", "VIEW"));
  return (
    <div>
      <PageHeader title="Solicitações" description="Trocas de escala e pedidos de folga da equipe." />
      <EmptyState
        icon={<Send size={28} />}
        title="Disponível na próxima etapa"
        description="A gestão de trocas e solicitações será implementada numa fase futura do Mídia ADESF."
      />
    </div>
  );
}
