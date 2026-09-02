import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { CRM_TABS, filterTabsForUser } from "@/lib/nav";
import { ProposalBoard } from "./proposal-board";

export default async function ProposalsPage() {
  const user = await requirePermission(permKey("CRM", "VIEW"));

  const [proposals, leads, clients, organization] = await Promise.all([
    db.proposal.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { updatedAt: "desc" },
      include: { lead: { select: { company: true } }, client: { select: { companyName: true } } },
    }),
    db.lead.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, company: true },
      orderBy: { company: "asc" },
    }),
    db.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("CRM", "CREATE")),
    canEdit: hasPermission(user, permKey("CRM", "EDIT")),
    canDelete: hasPermission(user, permKey("CRM", "DELETE")),
  };

  return (
    <div>
      <PageHeader title="Propostas" description="Propostas comerciais vinculadas a leads e clientes, do rascunho ao fechamento." />
      <SectionTabs tabs={filterTabsForUser(CRM_TABS, user.permissions)} />
      <ProposalBoard
        proposals={proposals.map((p) => ({
          id: p.id,
          title: p.title,
          leadId: p.leadId,
          leadCompany: p.lead?.company ?? null,
          clientId: p.clientId,
          clientName: p.client?.companyName ?? null,
          value: Number(p.value),
          status: p.status,
          validUntil: p.validUntil?.toISOString() ?? null,
          sentAt: p.sentAt?.toISOString() ?? null,
          notes: p.notes,
          createdAt: p.createdAt.toISOString(),
        }))}
        leads={leads}
        clients={clients}
        currency={organization.currency}
        permissions={permissions}
      />
    </div>
  );
}
