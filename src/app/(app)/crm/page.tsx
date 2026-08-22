import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { LeadBoard } from "./lead-board";

export default async function CrmPage() {
  const user = await requirePermission(permKey("CRM", "VIEW"));

  const [leads, users, organization] = await Promise.all([
    db.lead.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { owner: { select: { id: true, name: true } } },
    }),
    db.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { currency: true },
    }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("CRM", "CREATE")),
    canEdit: hasPermission(user, permKey("CRM", "EDIT")),
    canDelete: hasPermission(user, permKey("CRM", "DELETE")),
    canManage: hasPermission(user, permKey("CRM", "MANAGE")),
  };

  return (
    <div>
      <PageHeader
        title="CRM e Prospecção"
        description="Lead → Contato → Qualificado → Reunião → Proposta → Negociação → Fechado → Perdido."
      />
      <LeadBoard
        leads={leads.map((l) => ({
          ...l,
          potentialValue: l.potentialValue ? Number(l.potentialValue) : null,
          nextContactAt: l.nextContactAt?.toISOString() ?? null,
          lastContactAt: l.lastContactAt?.toISOString() ?? null,
          createdAt: l.createdAt.toISOString(),
        }))}
        users={users}
        currency={organization.currency}
        permissions={permissions}
      />
    </div>
  );
}
