import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { MediaTeamList } from "./team-list";

export default async function MediaAdesfTeamPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));

  const members = await db.mediaMember.findMany({
    where: { organizationId: user.organizationId },
    include: {
      user: { select: { name: true, email: true, avatarUrl: true } },
      functions: { include: { function: true } },
      _count: { select: { availabilityRecurring: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const allFunctions = await db.mediaFunction.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <PageHeader title="Equipe Mídia ADESF" description="Membros da equipe de mídia, convites e acesso ao portal." />
      <MediaTeamList
        allFunctions={allFunctions}
        members={members.map((m) => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          status: m.status,
          phone: m.phone,
          primaryFunction: m.functions.find((f) => f.isPrimary)?.function.name ?? null,
          enabledFunctions: m.functions.filter((f) => !f.isPrimary).map((f) => f.function.name),
          functionIds: m.functions.map((f) => f.functionId),
          hasAvailability: m._count.availabilityRecurring > 0,
        }))}
        canCreate={hasPermission(user, permKey("MEDIA_ADESF", "CREATE"))}
        canEdit={hasPermission(user, permKey("MEDIA_ADESF", "EDIT"))}
      />
    </div>
  );
}
