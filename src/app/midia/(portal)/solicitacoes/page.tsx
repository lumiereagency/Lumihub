import { MessageSquareText } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaPortalRequestsPage() {
  await requireMediaMember();
  return (
    <div>
      <PageHeader title="Solicitações" description="Trocas de escala e pedidos de folga." />
      <EmptyState
        icon={<MessageSquareText size={28} />}
        title="Disponível na próxima etapa"
        description="Trocas de escala e solicitações serão implementadas numa fase futura do Mídia ADESF."
      />
    </div>
  );
}
