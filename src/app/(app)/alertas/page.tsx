import { requirePermission, hasPermission, isDirector } from "@/lib/auth/guard";
import { visibleAlertCategories } from "@/lib/alerts/visibility";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { syncAlerts } from "@/lib/alerts/rules";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { AlertList } from "./alert-list";

export default async function AlertsPage() {
  const user = await requirePermission(permKey("ALERTS", "VIEW"));

  await syncAlerts(user.organizationId);

  // Cada pessoa vê só os alertas das áreas em que trabalha (dinheiro para o
  // financeiro, mídia para quem gerencia a Mídia ADESF, e assim por diante).
  const categories = isDirector(user) ? undefined : visibleAlertCategories(user.permissions);
  const alerts = await db.alert.findMany({
    where: { organizationId: user.organizationId, ...(categories ? { category: { in: categories } } : {}) },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const open = alerts.filter((a) => a.status === "ABERTO");
  const urgentCount = open.filter((a) => a.severity === "URGENTE").length;
  const attentionCount = open.filter((a) => a.severity === "ATENCAO").length;
  const opportunityCount = open.filter((a) => a.severity === "OPORTUNIDADE").length;

  const canAct = hasPermission(user, permKey("ALERTS", "VIEW"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Central de Alertas"
        description="Alertas financeiros, comerciais, operacionais, de clientes, contratos e equipe, gerados a partir dos dados reais da organização."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Abertos" value={String(open.length)} tone="accent" />
        <MetricCard label="Urgentes" value={String(urgentCount)} />
        <MetricCard label="Atenção" value={String(attentionCount)} />
        <MetricCard label="Oportunidades" value={String(opportunityCount)} />
      </div>

      <AlertList
        alerts={alerts.map((a) => ({
          id: a.id,
          category: a.category,
          severity: a.severity,
          title: a.title,
          message: a.message,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
          resolvedAt: a.resolvedAt?.toISOString() ?? null,
        }))}
        canAct={canAct}
      />
    </div>
  );
}
