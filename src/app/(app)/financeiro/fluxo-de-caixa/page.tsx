import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getCashFlowProjection } from "@/lib/finance/cashflow";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LineAreaChart } from "@/components/charts/line-area-chart";

export default async function CashFlowPage() {
  const user = await requirePermission(permKey("FINANCE", "VIEW"));

  const [projection, organization] = await Promise.all([
    getCashFlowProjection(user.organizationId),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const currency = organization.currency;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fluxo de Caixa"
        description="Previsão de caixa em 7, 30, 90 dias, 6 e 12 meses, a partir das contas a receber, contas a pagar e faturas de cartão já lançadas — nunca uma projeção fictícia."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {projection.horizons.map((h) => (
          <MetricCard
            key={h.key}
            label={`Saldo projetado — ${h.label}`}
            value={formatCurrency(h.projectedBalance, currency)}
            tone={h.projectedBalance < 0 ? "default" : "gold"}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <MetricCard label="Ponto de equilíbrio" value={formatCurrency(projection.pontoEquilibrio, currency)} />
        <MetricCard label="Reserva operacional (saldo atual)" value={formatCurrency(projection.reservaAtual, currency)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projeção de saldo — próximos 12 meses</CardTitle>
        </CardHeader>
        {projection.hasPendingData ? (
          <LineAreaChart data={projection.monthlySeries} currency={currency} />
        ) : (
          <EmptyState title="Nenhuma conta a receber, a pagar ou fatura pendente para projetar." description="A projeção reflete apenas compromissos já lançados no sistema." />
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Próximos compromissos (90 dias)</CardTitle>
        </CardHeader>
        {projection.upcoming.length === 0 ? (
          <EmptyState title="Nenhum compromisso lançado para os próximos 90 dias." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {projection.upcoming.map((e, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0 hover:bg-card">
                    <td className="px-4 py-3 text-text-primary">{e.description}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={e.kind === "RECEITA" ? "success" : "neutral"}>{e.kind === "RECEITA" ? "Entrada" : "Saída"}</Badge>
                    </td>
                    <td className={e.kind === "RECEITA" ? "px-4 py-3 text-success" : "px-4 py-3 text-text-secondary"}>
                      {e.kind === "RECEITA" ? "+" : "-"} {formatCurrency(Math.abs(e.amount), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
