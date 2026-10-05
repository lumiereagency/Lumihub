import { requirePermission, isDirector } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { FINANCE_TABS, filterTabsForUser } from "@/lib/nav";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IMPOSTO, receivedIn, syncTaxes } from "@/lib/finance/taxes";
import { competenceLabel, competenceOf } from "@/lib/payroll/folha";
import { getPricingSettings } from "@/lib/pricing/settings";
import { formatDueDate } from "@/lib/billing/dates";
import { TaxSettingsForm } from "./tax-settings-form";

export default async function TaxesPage() {
  const user = await requirePermission(permKey("FINANCE", "VIEW"));
  await syncTaxes(user.organizationId);
  const comp = competenceOf(new Date());
  const [settings, received, das] = await Promise.all([
    getPricingSettings(user.organizationId),
    receivedIn(user.organizationId, comp),
    db.accountPayable.findMany({ where: { organizationId: user.organizationId, kind: IMPOSTO, status: { not: "CANCELADO" } }, orderBy: { competence: "desc" }, take: 24 }),
  ]);
  const reserve = Math.round(received * settings.taxRate) / 100;
  const open = das.filter((d) => d.status !== "PAGO");
  const paidYear = das.filter((d) => d.status === "PAGO" && d.competence?.startsWith(comp.slice(0, 4))).reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Impostos" description={`Simples Nacional: ${settings.taxRate.toLocaleString("pt-BR")}% sobre tudo o que é recebido no mês, com a guia (DAS) no dia ${settings.taxDueDay} do mês seguinte.`} />
      <SectionTabs tabs={filterTabsForUser(FINANCE_TABS, user.permissions)} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard tone="accent" label="Separar para o imposto" value={formatCurrency(reserve)} caption={`${settings.taxRate.toLocaleString("pt-BR")}% do recebido em ${competenceLabel(comp).split(" de ")[0]}`} />
        <MetricCard label="Recebido no mês" value={formatCurrency(received)} caption="base do cálculo" />
        <MetricCard label="Guias em aberto" value={formatCurrency(open.reduce((s, d) => s + Number(d.amount), 0))} caption={open.length ? `${open.length} DAS a pagar` : "nada em aberto"} />
        <MetricCard label={`Pago em ${comp.slice(0, 4)}`} value={formatCurrency(paidYear)} caption="DAS quitados no ano" />
      </div>

      {isDirector(user) && <TaxSettingsForm rate={settings.taxRate} dueDay={settings.taxDueDay} />}

      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-text-primary">Guias do Simples (DAS)</p>
        {das.length === 0 ? (
          <EmptyState title="Nenhuma guia ainda" description="Assim que algo for recebido no mês, a reserva do imposto aparece aqui e em Contas a Pagar." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
                  <th className="px-4 py-3 font-medium">Competência</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {das.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-card-elevated/50">
                    <td className="px-4 py-3">
                      <p className="text-text-primary">{d.competence ? competenceLabel(d.competence).replace(/^./, (c) => c.toUpperCase()) : "—"}</p>
                      <p className="text-xs text-text-tertiary">{d.description.split("(")[1]?.replace(")", "") ?? ""}</p>
                    </td>
                    <td className="lb-figures px-4 py-3 text-text-primary">{formatCurrency(Number(d.amount))}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDueDate(d.dueDate)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={d.status === "PAGO" ? "success" : d.dueDate < new Date() ? "error" : "accent"}>
                        {d.status === "PAGO" ? "Pago" : d.dueDate < new Date() ? "Vencido" : d.competence === comp ? "Acumulando no mês" : "A pagar"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-text-tertiary">A guia do mês corrente vai sendo atualizada a cada recebimento e fecha no fim do mês. Para dar baixa, pague em Contas a Pagar.</p>
      </section>
    </div>
  );
}
