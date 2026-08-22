import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getFinanceOverview } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { GroupedBarChart } from "@/components/charts/grouped-bar-chart";
import { CategoriesPanel } from "./categories-panel";

export default async function FinancePage() {
  const user = await requirePermission(permKey("FINANCE", "VIEW"));

  const [overview, organization, categories, costCenters] = await Promise.all([
    getFinanceOverview(user.organizationId),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
    db.financialCategory.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    db.costCenter.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
  ]);

  const currency = organization.currency;
  const canManage = hasPermission(user, permKey("FINANCE", "MANAGE"));
  const { kpis, indicators, charts } = overview;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Visão Financeira" description="Saldo, receitas, despesas, margem e indicadores financeiros consolidados." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Saldo atual" value={formatCurrency(kpis.saldoAtual, currency)} tone="gold" />
        <MetricCard label="Receita do mês" value={formatCurrency(kpis.receitaMes, currency)} />
        <MetricCard label="Despesas do mês" value={formatCurrency(kpis.despesaMes, currency)} />
        <MetricCard label="Lucro estimado" value={formatCurrency(kpis.lucroEstimado, currency)} />
        <MetricCard label="A receber" value={formatCurrency(kpis.aReceber, currency)} />
        <MetricCard label="A pagar" value={formatCurrency(kpis.aPagar, currency)} />
        <MetricCard label="Atrasados" value={formatCurrency(kpis.atrasados, currency)} />
        <MetricCard label="Compromissos futuros (30d)" value={formatCurrency(kpis.compromissosFuturos, currency)} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Margem" value={`${indicators.margem.toFixed(1)}%`} />
        <MetricCard label="Ponto de equilíbrio" value={formatCurrency(indicators.pontoEquilibrio, currency)} />
        <MetricCard label="Burn rate" value={formatCurrency(indicators.burnRate, currency)} />
        <MetricCard label="Reserva operacional" value={formatCurrency(indicators.reservaAtual, currency)} />
        <MetricCard
          label="Meses de cobertura"
          value={indicators.mesesCobertura == null ? "Sem burn rate" : indicators.mesesCobertura.toFixed(1)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Receita x Despesa — últimos 6 meses</CardTitle>
          </CardHeader>
          <GroupedBarChart data={charts.receitaDespesaMensal} currency={currency} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <HorizontalBarChart
            data={charts.despesaPorCategoria}
            currency={currency}
            emptyLabel="Nenhuma despesa paga com categoria registrada ainda."
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receita por cliente</CardTitle>
          </CardHeader>
          <HorizontalBarChart data={charts.receitaPorCliente} currency={currency} emptyLabel="Nenhuma receita recebida ainda." />
        </Card>
      </div>

      <CategoriesPanel categories={categories} costCenters={costCenters} canManage={canManage} />
    </div>
  );
}
