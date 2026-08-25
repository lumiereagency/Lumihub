import { AlertTriangle, ClipboardCheck, RefreshCcw, TrendingDown, TrendingUp } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { syncAlerts } from "@/lib/alerts/rules";
import { getWorkloadInsights, getSwapPatternInsights, getConfirmationRateInsights } from "@/lib/media/ai/insights";
import { ALERT_SEVERITY_LABELS, ALERT_SEVERITY_TONE, ALERT_SEVERITIES } from "@/lib/validation/alerts";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const WINDOW_DAYS = 90;

// Relatórios de IA/insights (§17-22): só líderes/admins acessam — mesma
// permissão MANAGE que já protege "Publicar" e "Gerar Escala com IA". Nunca
// exposto ao portal do membro comum (§22: "sem comparação entre membros").
export default async function MediaAdesfReportsPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "MANAGE"));

  await syncAlerts(user.organizationId);

  const now = new Date();
  const periodStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [workload, swapPatterns, confirmationRates, openAlerts] = await Promise.all([
    getWorkloadInsights(user.organizationId, periodStart, now),
    getSwapPatternInsights(user.organizationId, periodStart),
    getConfirmationRateInsights(user.organizationId, periodStart),
    db.alert.findMany({ where: { organizationId: user.organizationId, category: "MIDIA_ADESF", status: "ABERTO" }, orderBy: { createdAt: "desc" } }),
  ]);

  const overloaded = workload.filter((w) => w.status === "SOBRECARREGADO");
  const underutilized = workload.filter((w) => w.status === "SUBUTILIZADO");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Relatórios — Mídia ADESF"
        description={`Insights e alertas dos últimos ${WINDOW_DAYS} dias, calculados a partir dos dados reais da operação.`}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Alertas abertos</h2>
        {openAlerts.length === 0 ? (
          <EmptyState icon={<AlertTriangle size={24} />} title="Nenhum alerta aberto no momento" />
        ) : (
          <div className="flex flex-col gap-2">
            {openAlerts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{a.title}</p>
                  <p className="text-sm text-text-secondary">{a.message}</p>
                </div>
                <Badge tone={ALERT_SEVERITY_TONE[a.severity as (typeof ALERT_SEVERITIES)[number]]}>
                  {ALERT_SEVERITY_LABELS[a.severity as (typeof ALERT_SEVERITIES)[number]]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Carga de trabalho</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard label="Sobrecarregados" value={String(overloaded.length)} icon={<TrendingUp size={18} />} />
          <MetricCard label="Subutilizados" value={String(underutilized.length)} icon={<TrendingDown size={18} />} />
        </div>
        {workload.length === 0 ? (
          <p className="mt-4 text-sm text-text-tertiary">Nenhum membro ativo para comparar.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-1.5">
            {workload.map((w) => (
              <div key={w.memberId} className="flex items-center justify-between rounded-[8px] border border-border px-3 py-2 text-sm">
                <span className="text-text-primary">{w.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-text-tertiary">{w.assignmentsCount} escala(s)</span>
                  {w.status === "SOBRECARREGADO" && <Badge tone="warning">Sobrecarregado</Badge>}
                  {w.status === "SUBUTILIZADO" && <Badge tone="info">Subutilizado</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Padrões de troca</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Solicitações" value={String(swapPatterns.totalRequests)} icon={<RefreshCcw size={18} />} />
          <MetricCard label="Aprovadas" value={String(swapPatterns.approvedCount)} />
          <MetricCard label="Taxa de aprovação" value={swapPatterns.approvalRate !== null ? `${Math.round(swapPatterns.approvalRate * 100)}%` : "—"} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Mais solicitam troca</p>
            {swapPatterns.topRequesters.length === 0 ? (
              <p className="text-sm text-text-tertiary">Sem dados no período.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {swapPatterns.topRequesters.map((r) => (
                  <Badge key={r.memberId} tone="neutral">
                    {r.name} — {r.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Mais procurados como substituto</p>
            {swapPatterns.topTargets.length === 0 ? (
              <p className="text-sm text-text-tertiary">Sem dados no período.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {swapPatterns.topTargets.map((t) => (
                  <Badge key={t.memberId} tone="neutral">
                    {t.name} — {t.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Índice de confirmação e comparecimento</h2>
        {confirmationRates.length === 0 ? (
          <EmptyState icon={<ClipboardCheck size={24} />} title="Nenhum culto concluído no período" />
        ) : (
          <div className="flex flex-col gap-1.5">
            {confirmationRates.map((c) => (
              <div key={c.memberId} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-border px-3 py-2 text-sm">
                <span className="text-text-primary">{c.name}</span>
                <div className="flex items-center gap-2 text-text-tertiary">
                  <span>
                    {c.confirmedCount}/{c.totalPast} confirmadas
                  </span>
                  {c.noShowCount > 0 && <Badge tone="error">{c.noShowCount} ausência(s)</Badge>}
                  <span>{c.confirmationRate !== null ? `${Math.round(c.confirmationRate * 100)}%` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
