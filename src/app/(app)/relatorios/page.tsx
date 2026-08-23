import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getFinancialReport, getCommercialReport, getClientsReport, getProjectsReport, getTeamReport } from "@/lib/reports/queries";
import { PageHeader } from "@/components/layout/page-header";
import { ReportTabs } from "./report-tabs";

export default async function ReportsPage() {
  const user = await requirePermission(permKey("REPORTS", "VIEW"));

  const [financeiro, comercial, clientes, projetos, equipe, organization] = await Promise.all([
    getFinancialReport(user.organizationId),
    getCommercialReport(user.organizationId),
    getClientsReport(user.organizationId),
    getProjectsReport(user.organizationId),
    getTeamReport(user.organizationId),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const canExport = hasPermission(user, permKey("REPORTS", "EXPORT"));

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Relatórios financeiros, comerciais, de clientes, projetos, equipe e margem, com exportação."
      />
      <ReportTabs data={{ financeiro, comercial, clientes, projetos, equipe }} currency={organization.currency} canExport={canExport} />
    </div>
  );
}
