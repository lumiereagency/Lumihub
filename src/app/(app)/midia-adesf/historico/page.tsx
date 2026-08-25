import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { AuditHistoryList } from "@/components/media/audit-history-list";

const MEDIA_ENTITY_TYPES = [
  "MediaMember",
  "MediaFunction",
  "MediaBrandSettings",
  "MediaEvent",
  "MediaEventRecurrence",
  "MediaSchedule",
  "MediaScheduleAssignment",
  "MediaSwapRequest",
];

export default async function MediaAdesfHistoryPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));

  const entries = await db.auditLog.findMany({
    where: { organizationId: user.organizationId, entityType: { in: MEDIA_ENTITY_TYPES } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader title="Histórico" description="Trilha de auditoria de todas as ações do Mídia ADESF." />
      <AuditHistoryList
        entries={entries.map((e) => ({ id: e.id, action: e.action, createdAt: e.createdAt, userName: e.user?.name ?? null, metadata: e.metadata }))}
      />
    </div>
  );
}
