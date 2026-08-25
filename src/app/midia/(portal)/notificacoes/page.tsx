import { Bell } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaPortalNotificationsPage() {
  await requireMediaMember();
  return (
    <div>
      <PageHeader title="Notificações" description="Avisos da liderança e da equipe de mídia." />
      <EmptyState
        icon={<Bell size={28} />}
        title="Disponível na próxima etapa"
        description="As notificações automáticas serão implementadas numa fase futura do Mídia ADESF."
      />
    </div>
  );
}
