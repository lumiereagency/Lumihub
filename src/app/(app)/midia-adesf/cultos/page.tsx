import { Clapperboard } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaAdesfServicesPage() {
  await requirePermission(permKey("MEDIA_ADESF", "VIEW"));
  return (
    <div>
      <PageHeader title="Cultos" description="Cadastro de cultos e eventos cobertos pela equipe de mídia." />
      <EmptyState
        icon={<Clapperboard size={28} />}
        title="Disponível na próxima etapa"
        description="O cadastro de cultos e eventos será implementado numa fase futura do Mídia ADESF."
      />
    </div>
  );
}
