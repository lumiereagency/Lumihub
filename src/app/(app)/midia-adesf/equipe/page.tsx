import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { MediaTeamList } from "./team-list";

export default async function MediaAdesfTeamPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));

  const members = await db.mediaMember.findMany({
    where: { organizationId: user.organizationId },
    include: { user: { select: { name: true, email: true, avatarUrl: true } }, functions: { include: { function: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Equipe Mídia ADESF" description="Membros da equipe de mídia, convites e acesso ao portal." />
      <MediaTeamList
        members={members.map((m) => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          status: m.status,
          primaryFunction: m.functions.find((f) => f.isPrimary)?.function.name ?? null,
        }))}
        canCreate={hasPermission(user, permKey("MEDIA_ADESF", "CREATE"))}
        canEdit={hasPermission(user, permKey("MEDIA_ADESF", "EDIT"))}
      />
    </div>
  );
}
