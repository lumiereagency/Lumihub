import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { ReceivableList } from "./receivable-list";

export default async function ReceivablesPage() {
  const user = await requirePermission(permKey("RECEIVABLES", "VIEW"));

  const [receivables, clients, contracts, organization] = await Promise.all([
    db.accountReceivable.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { dueDate: "asc" },
      include: { client: { select: { companyName: true } } },
    }),
    db.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    db.contract.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, title: true, clientId: true },
      orderBy: { title: "asc" },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("RECEIVABLES", "CREATE")),
    canEdit: hasPermission(user, permKey("RECEIVABLES", "EDIT")),
    canDelete: hasPermission(user, permKey("RECEIVABLES", "DELETE")),
  };

  return (
    <div>
      <PageHeader title="Contas a Receber" description="Cobranças, régua de lembretes e confirmação de pagamentos." />
      <ReceivableList
        receivables={receivables.map((r) => ({
          id: r.id,
          clientId: r.clientId,
          contractId: r.contractId,
          description: r.description,
          amount: Number(r.amount),
          dueDate: r.dueDate.toISOString(),
          status: r.status,
          paymentMethod: r.paymentMethod,
          paidAt: r.paidAt?.toISOString() ?? null,
          proofUrl: r.proofUrl,
          notes: r.notes,
          clientName: r.client.companyName,
        }))}
        clients={clients}
        contracts={contracts}
        currency={organization.currency}
        permissions={permissions}
      />
    </div>
  );
}
