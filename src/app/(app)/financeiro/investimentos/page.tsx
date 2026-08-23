import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { InvestmentList } from "./investment-list";

export default async function InvestmentsPage() {
  const user = await requirePermission(permKey("INVESTMENTS", "VIEW"));

  const [investments, organization] = await Promise.all([
    db.investment.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { date: "desc" },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const canCreate = hasPermission(user, permKey("INVESTMENTS", "CREATE"));

  return (
    <div>
      <PageHeader title="Investimentos" description="Equipamentos, tecnologia, marketing e expansão com objetivo e retorno esperado." />
      <InvestmentList
        investments={investments.map((i) => ({
          id: i.id,
          description: i.description,
          category: i.category,
          amount: Number(i.amount),
          date: i.date.toISOString(),
          installments: i.installments,
          paymentMethod: i.paymentMethod,
          objective: i.objective,
          expectedReturn: i.expectedReturn,
        }))}
        currency={organization.currency}
        canCreate={canCreate}
      />
    </div>
  );
}
