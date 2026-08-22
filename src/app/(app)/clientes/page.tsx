import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { ClientList } from "./client-list";

export default async function ClientsPage() {
  const user = await requirePermission(permKey("CLIENTS", "VIEW"));

  const [clients, receivablesByClient, organization] = await Promise.all([
    db.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { companyName: "asc" },
      include: { _count: { select: { contracts: true } } },
    }),
    db.accountReceivable.groupBy({
      by: ["clientId", "status"],
      where: { organizationId: user.organizationId, status: { in: ["PENDENTE", "ATRASADO"] } },
      _sum: { amount: true },
    }),
    db.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      select: { currency: true },
    }),
  ]);

  const pendingByClient = new Map<string, number>();
  for (const row of receivablesByClient) {
    pendingByClient.set(row.clientId, (pendingByClient.get(row.clientId) ?? 0) + Number(row._sum.amount ?? 0));
  }

  const permissions = {
    canCreate: hasPermission(user, permKey("CLIENTS", "CREATE")),
    canEdit: hasPermission(user, permKey("CLIENTS", "EDIT")),
  };

  return (
    <div>
      <PageHeader title="Clientes" description="Cadastro central de clientes da Lumière Agency." />
      <ClientList
        clients={clients.map((c) => ({
          id: c.id,
          companyName: c.companyName,
          contactName: c.contactName,
          email: c.email,
          phone: c.phone,
          status: c.status,
          contractsCount: c._count.contracts,
          pendingAmount: pendingByClient.get(c.id) ?? 0,
        }))}
        currency={organization.currency}
        permissions={permissions}
      />
    </div>
  );
}
