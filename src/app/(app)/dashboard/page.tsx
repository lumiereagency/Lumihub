import Link from "next/link";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Target,
  FolderKanban,
  AlertTriangle,
  CalendarClock,
  Sparkles,
  Plus,
  ArrowRight,
} from "lucide-react";
import { requirePermission, hasPermission, isDirector } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  getFinancialSummary,
  getCommercialSummary,
  getActiveProjectsCount,
  getUpcomingCommitments,
  getAttentionItems,
  getHealthScore,
} from "@/lib/dashboard/queries";
import { buildDashboardInsights } from "@/lib/dashboard/insights";
import { PendingCaptureAssignments } from "./pending-captures";
import { CommissionsSummary } from "./commissions-summary";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

function greeting(): string {
  // O servidor roda em UTC — a saudação precisa seguir o horário de Brasília.
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage() {
  const user = await requirePermission(permKey("DASHBOARD", "VIEW"));

  // Fase 46: o Dashboard é a tela inicial de todo mundo, inclusive de quem
  // não tem acesso ao Financeiro/CRM/Projetos (ex: videomaker) — cada bloco
  // só aparece pra quem tem a permissão do módulo de onde o dado vem, pra
  // liberar o Dashboard não vazar valores de outros módulos.
  const canViewFinance = hasPermission(user, permKey("FINANCE", "VIEW"));
  const canViewCRM = hasPermission(user, permKey("CRM", "VIEW"));
  const canViewProjects = hasPermission(user, permKey("PROJECTS", "VIEW"));
  const canViewContracts = hasPermission(user, permKey("CONTRACTS", "VIEW"));
  const canViewCalendar = hasPermission(user, permKey("CALENDAR", "VIEW"));
  // Atalhos de criação no topo (§ pedido do usuário: "agilizar tudo através
  // do dashboard, não precisar ficar toda hora entrando nas abas") — vão
  // direto pra tela certa já prontos pra criar, sem precisar navegar até
  // achar o botão "Novo" lá dentro.
  const quickCreateLinks = [
    hasPermission(user, permKey("CLIENTS", "CREATE")) && { label: "Novo cliente", href: "/clientes" },
    hasPermission(user, permKey("CRM", "CREATE")) && { label: "Novo lead", href: "/crm" },
    hasPermission(user, permKey("PROJECTS", "CREATE")) && { label: "Novo projeto", href: "/projetos" },
    hasPermission(user, permKey("TASKS", "CREATE")) && { label: "Nova tarefa", href: "/tarefas" },
  ].filter((l): l is { label: string; href: string } => Boolean(l));

  const organization = await db.organization.findUniqueOrThrow({
    where: { id: user.organizationId },
    select: { currency: true },
  });

  const now = new Date();
  const [finance, commercial, activeProjects, commitments, attention, health, currentGoal] =
    await Promise.all([
      getFinancialSummary(user.organizationId),
      getCommercialSummary(user.organizationId),
      getActiveProjectsCount(user.organizationId),
      getUpcomingCommitments(user.organizationId),
      getAttentionItems(user.organizationId),
      getHealthScore(user.organizationId),
      db.goal.findFirst({
        where: {
          organizationId: user.organizationId,
          type: "FATURAMENTO",
          periodStart: { lte: now },
          periodEnd: { gte: now },
        },
      }),
    ]);

  const currency = organization.currency;
  const insights =
    canViewFinance || canViewCRM
      ? buildDashboardInsights({
          currency,
          // Sem acesso ao financeiro, nenhum número de caixa entra nos insights.
          aReceber: canViewFinance ? finance.aReceber : 0,
          aPagar: canViewFinance ? finance.aPagar : 0,
          overdueReceivablesCount: canViewFinance ? attention.overdueReceivables.length : 0,
          overdueReceivablesTotal: canViewFinance ? attention.overdueReceivables.reduce((s, r) => s + Number(r.amount), 0) : 0,
          pipelineTotal: canViewCRM ? commercial.pipelineTotal : 0,
          pipelineWeighted: canViewCRM ? commercial.pipelineWeighted : 0,
          goalTarget: canViewFinance && currentGoal ? Number(currentGoal.targetValue) : null,
        })
      : [];

  const visibleOverdueReceivables = canViewFinance ? attention.overdueReceivables : [];
  const visibleOverdueProjects = canViewProjects ? attention.overdueProjects : [];
  const visibleExpiringContracts = canViewContracts ? attention.expiringContracts : [];
  const attentionCount = visibleOverdueReceivables.length + visibleOverdueProjects.length + visibleExpiringContracts.length;

  // Cada linha já leva pra tela certa pra resolver — não só informa, deixa
  // agir (§ pedido do usuário: "não precisar ficar toda hora entrando nas
  // abas" — aqui pelo menos já entra direto na aba certa em vez de precisar
  // descobrir qual é).
  const commitmentRows = [
    ...(canViewCalendar
      ? commitments.events.map((e) => ({
          key: `event-${e.id}`,
          label: e.title,
          sub: e.client?.companyName ?? e.type,
          date: e.startAt,
          href: "/agenda",
        }))
      : []),
    ...(canViewFinance
      ? commitments.receivables.map((r) => ({
          key: `rec-${r.id}`,
          label: `Cobrança — ${r.client.companyName}`,
          sub: formatCurrency(Number(r.amount), currency),
          date: r.dueDate,
          href: "/financeiro/receber",
        }))
      : []),
    ...(canViewFinance
      ? commitments.payables.map((p) => ({
          key: `pay-${p.id}`,
          label: p.description,
          sub: formatCurrency(Number(p.amount), currency),
          date: p.dueDate,
          href: "/financeiro/pagar",
        }))
      : []),
    ...(canViewContracts
      ? commitments.contracts.map((c) => ({
          key: `contract-${c.id}`,
          label: `Contrato vencendo — ${c.client.companyName}`,
          sub: c.title,
          date: c.endDate!,
          href: `/clientes/${c.client.id}`,
        }))
      : []),
  ]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description="Acompanhe suas tarefas, o progresso da equipe e os números da Lumière."
        actions={
          quickCreateLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {quickCreateLinks.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    i === 0
                      ? "inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90"
                      : "inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-medium text-text-primary hover:bg-card-elevated"
                  }
                >
                  <Plus size={14} /> {link.label}
                </Link>
              ))}
            </div>
          )
        }
      />

      <PendingCaptureAssignments userId={user.id} />

      {canViewCRM && <CommissionsSummary organizationId={user.organizationId} userId={user.id} director={isDirector(user)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canViewFinance && (
          <>
            <MetricCard label="Saldo atual" value={formatCurrency(finance.saldoAtual, currency)} caption="entradas menos saídas pagas" icon={<Wallet />} tone="accent" />
            <MetricCard label="A receber" value={formatCurrency(finance.aReceber, currency)} caption="cobranças em aberto" icon={<ArrowDownCircle />} />
            <MetricCard label="A pagar" value={formatCurrency(finance.aPagar, currency)} caption="contas em aberto" icon={<ArrowUpCircle />} />
            <MetricCard
              label="Resultado projetado"
              value={formatCurrency(finance.resultadoProjetado30, currency)}
              caption="próximos 30 dias"
              icon={<TrendingUp />}
            />
          </>
        )}
        {canViewCRM && (
          <>
            <MetricCard label="Pipeline comercial" value={formatCurrency(commercial.pipelineTotal, currency)} caption="leads em aberto" icon={<Target />} />
            <MetricCard
              label="Pipeline ponderado"
              value={formatCurrency(commercial.pipelineWeighted, currency)}
              caption="valor × chance de fechar"
              icon={<Target />}
            />
          </>
        )}
        {canViewProjects && (
          <MetricCard label="Projetos ativos" value={String(activeProjects)} caption="em andamento" icon={<FolderKanban />} />
        )}
        {(canViewFinance || canViewProjects || canViewContracts) && (
          <MetricCard label="Precisam de atenção" value={String(attentionCount)} caption="atrasos e vencimentos" icon={<AlertTriangle />} />
        )}
      </div>

      <div className={`grid grid-cols-1 gap-4 ${canViewFinance || canViewCRM || canViewProjects ? "lg:grid-cols-3" : ""}`}>
        {(canViewFinance || canViewCRM || canViewProjects) && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Saúde da Lumi</CardTitle>
            </CardHeader>
            <div className="flex items-baseline gap-2">
              <span className="text-[48px] font-semibold leading-none tracking-tight text-text-primary">{health.overall}</span>
              <span className="text-sm text-text-tertiary">de 100</span>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {Object.entries(health.breakdown)
                .filter(([key]) => canViewFinance || (key !== "financeiro" && key !== "caixaFuturo"))
                .map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm capitalize text-text-secondary">{key}</span>
                  <div className="lb-stripes h-2.5 flex-1 overflow-hidden rounded-full">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs text-text-secondary">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className={canViewFinance || canViewCRM || canViewProjects ? "lg:col-span-2" : undefined}>
          <CardHeader>
            <CardTitle>Próximos compromissos</CardTitle>
          </CardHeader>
          {commitmentRows.length === 0 ? (
            <EmptyState
              icon={<CalendarClock size={24} />}
              title="Nenhum compromisso nos próximos 14 dias"
              description="Captações, reuniões, cobranças e vencimentos aparecerão aqui."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {commitmentRows.map((row) => (
                <Link
                  key={row.key}
                  href={row.href}
                  className="group -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-card-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">{row.label}</p>
                    <p className="text-xs text-text-tertiary">{row.sub}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">{formatDate(row.date)}</Badge>
                    <ArrowRight size={14} className="text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${insights.length > 0 ? "lg:grid-cols-2" : ""}`}>
        <Card>
          <CardHeader>
            <CardTitle>Atenção</CardTitle>
          </CardHeader>
          {attentionCount === 0 ? (
            <EmptyState
              icon={<AlertTriangle size={24} />}
              title="Nada precisa da sua atenção agora"
              description="Pagamentos atrasados, projetos atrasados e contratos vencendo aparecerão aqui."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {visibleOverdueReceivables.map((r) => (
                <Link
                  key={r.id}
                  href={`/clientes/${r.client.id}`}
                  className="flex items-center justify-between rounded-xl bg-error/5 px-3 py-2 text-sm transition-colors hover:bg-error/10"
                >
                  <span className="text-text-primary">Pagamento atrasado — {r.client.companyName}</span>
                  <Badge tone="error">{formatCurrency(Number(r.amount), currency)}</Badge>
                </Link>
              ))}
              {visibleOverdueProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projetos/${p.id}`}
                  className="flex items-center justify-between rounded-xl bg-warning/5 px-3 py-2 text-sm transition-colors hover:bg-warning/10"
                >
                  <span className="text-text-primary">Projeto atrasado — {p.name}</span>
                  <Badge tone="warning">{p.client.companyName}</Badge>
                </Link>
              ))}
              {visibleExpiringContracts.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.client.id}`}
                  className="flex items-center justify-between rounded-xl bg-info/5 px-3 py-2 text-sm transition-colors hover:bg-info/10"
                >
                  <span className="text-text-primary">Contrato vencendo — {c.client.companyName}</span>
                  <Badge tone="info">{formatDate(c.endDate!)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {insights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles size={16} className="text-accent" /> Insights
              </CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2">
              {insights.map((insight, idx) => (
                <div key={idx} className="rounded-xl bg-card-elevated px-4 py-3 text-sm text-text-secondary">
                  {insight.text}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
