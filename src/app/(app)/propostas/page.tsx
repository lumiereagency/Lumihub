import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { requirePermission, hasPermission, isDirector } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { CRM_TABS, filterTabsForUser } from "@/lib/nav";
import { ProposalBoard } from "./proposal-board";

export default async function ProposalsPage() {
  const user = await requirePermission(permKey("CRM", "VIEW"));

  const [proposals, organization] = await Promise.all([
    db.proposal.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { updatedAt: "desc" },
      include: {
        lead: { select: { company: true } },
        client: { select: { companyName: true } },
        createdBy: { select: { name: true } },
        contract: { select: { signatureStatus: true, signatureSentAt: true } },
      },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);
  const canManage = isDirector(user);

  return (
    <div>
      <PageHeader
        title="Orçamentos"
        description="Monte com a tabela de serviços, envie o link personalizado e acompanhe até o contrato assinado."
        actions={
          canManage && (
            <Link href="/propostas/configuracoes" className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-text-primary hover:bg-card-elevated">
              <SlidersHorizontal size={16} /> <span className="hidden sm:inline">Taxas e pagamento</span>
            </Link>
          )
        }
      />
      <SectionTabs tabs={filterTabsForUser(CRM_TABS, user.permissions)} />
      <ProposalBoard
        proposals={proposals.map((p) => ({
          id: p.id,
          title: p.title,
          partyName: p.client?.companyName ?? p.lead?.company ?? null,
          recipientName: p.recipientName,
          createdBy: p.createdBy?.name ?? null,
          value: Number(p.value),
          monthlyTotal: p.monthlyTotal ? Number(p.monthlyTotal) : null,
          oneTimeTotal: p.oneTimeTotal ? Number(p.oneTimeTotal) : null,
          currency: p.currency,
          status: p.status,
          validUntil: p.validUntil?.toISOString() ?? null,
          sentAt: p.sentAt?.toISOString() ?? null,
          viewCount: p.viewCount,
          lastViewedAt: p.lastViewedAt?.toISOString() ?? null,
          response: p.response,
          contractStatus: p.contract ? (p.contract.signatureStatus ?? (p.contract.signatureSentAt ? "PENDING" : "DRAFT")) : null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }))}
        currency={organization.currency}
        canCreate={hasPermission(user, permKey("CRM", "CREATE"))}
        now={new Date().getTime()}
      />
    </div>
  );
}
