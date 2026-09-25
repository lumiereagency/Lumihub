import Link from "next/link";
import { Video } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { CRM_TABS, filterTabsForUser } from "@/lib/nav";
import { LeadBoard, type LeadActivity } from "./lead-board";

export default async function CrmPage() {
  const user = await requirePermission(permKey("CRM", "VIEW"));
  const canSeeTeam = user.isOwner || user.role.key === "ADMIN";

  const [leads, users, organization, auditLogs] = await Promise.all([
    db.lead.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    db.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
    db.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { currency: true },
    }),
    canSeeTeam
      ? db.auditLog.findMany({
          where: { organizationId: user.organizationId, entityType: "Lead" },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            action: true,
            entityId: true,
            metadata: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // Leads já excluídos continuam aparecendo no histórico pelo nome.
  const loggedIds = [...new Set(auditLogs.map((a) => a.entityId).filter((id): id is string => !!id))];
  const companyById = new Map(
    (loggedIds.length
      ? await db.lead.findMany({ where: { id: { in: loggedIds } }, select: { id: true, company: true } })
      : []
    ).map((l) => [l.id, l.company]),
  );

  const activity: LeadActivity[] = auditLogs.map((a) => {
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    return {
      id: a.id,
      action: a.action,
      leadId: a.entityId,
      company: (a.entityId && companyById.get(a.entityId)) || (typeof meta.company === "string" ? meta.company : "Lead"),
      from: typeof meta.from === "string" ? meta.from : null,
      to: typeof meta.to === "string" ? meta.to : null,
      userId: a.user?.id ?? null,
      userName: a.user?.name ?? "Sistema",
      createdAt: a.createdAt.toISOString(),
    };
  });

  const permissions = {
    canCreate: hasPermission(user, permKey("CRM", "CREATE")),
    canEdit: hasPermission(user, permKey("CRM", "EDIT")),
    canDelete: hasPermission(user, permKey("CRM", "DELETE")),
    canManage: hasPermission(user, permKey("CRM", "MANAGE")),
    canSeeTeam,
  };

  return (
    <div>
      <PageHeader
        title="CRM e Prospecção"
        description="Cadastre, acompanhe e feche seus leads em um só lugar."
        actions={
          permissions.canCreate && (
            <Link
              href="/crm/prospeccao-ia"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium text-text-primary hover:bg-card-elevated"
            >
              <Video size={16} /> Buscar leads com IA
            </Link>
          )
        }
      />
      <SectionTabs tabs={filterTabsForUser(CRM_TABS, user.permissions)} />
      <LeadBoard
        leads={leads.map((l) => ({
          id: l.id,
          company: l.company,
          contactName: l.contactName,
          phone: l.phone,
          whatsapp: l.whatsapp,
          instagram: l.instagram,
          website: l.website,
          city: l.city,
          segment: l.segment,
          source: l.source,
          temperature: l.temperature,
          ownerUserId: l.ownerUserId,
          owner: l.owner,
          createdBy: l.createdBy,
          potentialValue: l.potentialValue ? Number(l.potentialValue) : null,
          probability: l.probability,
          stage: l.stage,
          notes: l.notes,
          convertedClientId: l.convertedClientId,
          nextContactAt: l.nextContactAt?.toISOString() ?? null,
          lastContactAt: l.lastContactAt?.toISOString() ?? null,
          createdAt: l.createdAt.toISOString(),
        }))}
        users={users}
        currentUserId={user.id}
        currency={organization.currency}
        permissions={permissions}
        activity={activity}
        now={new Date().getTime()}
      />
    </div>
  );
}
