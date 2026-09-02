import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { FINANCE_TABS, filterTabsForUser } from "@/lib/nav";
import { PayableList } from "./payable-list";

export default async function PayablesPage() {
  const user = await requirePermission(permKey("PAYABLES", "VIEW"));

  const [payables, categories, costCenters, users, organization] = await Promise.all([
    db.accountPayable.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { dueDate: "asc" },
      include: { category: { select: { name: true } } },
    }),
    db.financialCategory.findMany({
      where: { organizationId: user.organizationId, type: "DESPESA" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.costCenter.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("PAYABLES", "CREATE")),
    canEdit: hasPermission(user, permKey("PAYABLES", "EDIT")),
    canDelete: hasPermission(user, permKey("PAYABLES", "DELETE")),
  };

  return (
    <div>
      <PageHeader title="Contas a Pagar" description="Despesas, recorrências, parcelamentos e centros de custo." />
      <SectionTabs tabs={filterTabsForUser(FINANCE_TABS, user.permissions)} />
      <PayableList
        payables={payables.map((p) => ({
          id: p.id,
          description: p.description,
          supplier: p.supplier,
          categoryId: p.categoryId,
          categoryName: p.category?.name ?? null,
          costCenterId: p.costCenterId,
          amount: Number(p.amount),
          dueDate: p.dueDate.toISOString(),
          status: p.status,
          recurring: p.recurring,
          installmentNumber: p.installmentNumber,
          installmentTotal: p.installmentTotal,
          responsibleUserId: p.responsibleUserId,
        }))}
        categories={categories}
        costCenters={costCenters}
        users={users}
        currency={organization.currency}
        permissions={permissions}
      />
    </div>
  );
}
