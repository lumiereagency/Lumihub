import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { ContractsView } from "./contracts-view";

export default async function ContractsPage() {
  const user = await requirePermission(permKey("CONTRACTS", "VIEW"));

  const [contracts, clients, templates, organization] = await Promise.all([
    db.contract.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { id: true, companyName: true } } },
    }),
    db.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, companyName: true, cnpj: true, contactName: true },
      orderBy: { companyName: "asc" },
    }),
    db.contractTemplate.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("CONTRACTS", "CREATE")),
    canEdit: hasPermission(user, permKey("CONTRACTS", "EDIT")),
    canDelete: hasPermission(user, permKey("CONTRACTS", "DELETE")),
    canManageTemplates: hasPermission(user, permKey("CONTRACTS", "MANAGE")),
  };

  return (
    <div>
      <PageHeader title="Contratos" description="Biblioteca de modelos e contratos gerados a partir dos dados cadastrados." />
      <ContractsView
        contracts={contracts.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.type,
          value: Number(c.value),
          recurrence: c.recurrence,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate?.toISOString() ?? null,
          paymentDay: c.paymentDay,
          status: c.status,
          generatedBody: c.generatedBody,
          client: c.client,
          templateId: c.templateId,
        }))}
        clients={clients}
        templates={templates}
        currency={organization.currency}
        permissions={permissions}
      />
    </div>
  );
}
