import "server-only";
import { formatCurrency } from "@/lib/format";

interface InsightInput {
  currency: string;
  aReceber: number;
  aPagar: number;
  overdueReceivablesCount: number;
  overdueReceivablesTotal: number;
  pipelineTotal: number;
  pipelineWeighted: number;
  goalTarget: number | null;
}

export interface Insight {
  tone: "info" | "warning" | "success" | "accent";
  text: string;
}

// Insights determinísticos, calculados a partir de dados reais do banco —
// não são gerados por modelo de linguagem. A Lumi AI conversacional (Fase 16)
// consulta os mesmos dados sob demanda, respeitando RBAC.
export function buildDashboardInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const c = (v: number) => formatCurrency(v, input.currency);

  if (input.overdueReceivablesCount > 0) {
    insights.push({
      tone: "warning",
      text: `${input.overdueReceivablesCount} cliente${input.overdueReceivablesCount > 1 ? "s" : ""} com pagamento em atraso, totalizando ${c(input.overdueReceivablesTotal)}.`,
    });
  }

  if (input.goalTarget && input.goalTarget > 0) {
    const coverage = Math.round((input.pipelineWeighted / input.goalTarget) * 100);
    insights.push({
      tone: coverage >= 100 ? "success" : "accent",
      text: `Seu pipeline ponderado cobre ${coverage}% da meta comercial do período.`,
    });
  } else if (input.pipelineTotal > 0) {
    insights.push({
      tone: "accent",
      text: `Pipeline aberto de ${c(input.pipelineTotal)} (ponderado: ${c(input.pipelineWeighted)}). Cadastre uma meta comercial para ver a cobertura.`,
    });
  }

  if (input.aReceber > 0 && input.aPagar > 0) {
    const diff = input.aReceber - input.aPagar;
    insights.push({
      tone: diff >= 0 ? "info" : "warning",
      text:
        diff >= 0
          ? `Você tem ${c(diff)} a mais em contas a receber do que a pagar em aberto.`
          : `Suas contas a pagar em aberto superam o que há a receber em ${c(Math.abs(diff))}.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      tone: "info",
      text: "Ainda não há dados suficientes para gerar insights. Cadastre clientes, contratos e cobranças para começar.",
    });
  }

  return insights;
}
