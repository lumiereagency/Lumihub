import { requirePermission, isDirector } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { byStage } from "@/lib/commissions/service";
import { CommissionsView } from "./commissions-view";

function monthStartSP(now: Date): Date {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(now).split("-");
  return new Date(`${y}-${m}-01T00:00:00-03:00`);
}

export default async function CommissionsPage() {
  const user = await requirePermission(permKey("CRM", "VIEW"));
  const director = isDirector(user);

  const rows = await db.commission.findMany({
    where: { organizationId: user.organizationId, ...(director ? {} : { sellerUserId: user.id }) },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      seller: { select: { id: true, name: true } },
      proposal: { select: { id: true, title: true, recipientName: true, respondedAt: true, client: { select: { companyName: true } }, lead: { select: { company: true } } } },
    },
  });

  // Mais recentes primeiro; dentro da mesma venda, sinal antes da quitação.
  const commissions = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.proposalId.localeCompare(b.proposalId) || byStage(a, b));

  return (
    <div>
      <PageHeader
        title="Comissões"
        description={
          director
            ? "Tudo o que o time vendeu e quanto você precisa pagar. A comissão é paga de uma vez, depois que o cliente paga."
            : "Suas vendas fechadas e o que já está liberado para receber."
        }
      />
      <CommissionsView
        director={director}
        currentUserId={user.id}
        monthStart={monthStartSP(new Date()).toISOString()}
        commissions={commissions.map((c) => ({
          id: c.id,
          proposalId: c.proposalId,
          proposalTitle: c.proposal.title,
          clientName: c.proposal.client?.companyName ?? c.proposal.lead?.company ?? c.proposal.recipientName ?? "Cliente",
          sellerId: c.seller?.id ?? null,
          sellerName: c.seller?.name ?? "Sem vendedor",
          stage: c.stage,
          description: c.description,
          amount: Number(c.amount),
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          releasedAt: c.releasedAt?.toISOString() ?? null,
          paidAt: c.paidAt?.toISOString() ?? null,
          cancelReason: c.cancelReason,
          lines: ((c.breakdown ?? []) as { name: string; rule: string; amount: number }[]).map((l) => ({ name: l.name, rule: l.rule, amount: l.amount })),
        }))}
      />
    </div>
  );
}
