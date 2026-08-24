"use client";

import { useActionState, useTransition } from "react";
import { Sparkles, X, Lightbulb } from "lucide-react";
import { generateInsightsAction, dismissInsightAction } from "@/lib/actions/insight-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { ALERT_SEVERITIES, ALERT_SEVERITY_LABELS, ALERT_SEVERITY_TONE } from "@/lib/validation/alerts";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

interface InsightRow {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  generatedAt: string;
  dismissedAt: string | null;
}

const initialState: ActionState = {};

export function InsightList({ insights, hasProvider }: { insights: InsightRow[]; hasProvider: boolean }) {
  const [state, formAction, pending] = useActionState(generateInsightsAction, initialState);
  const [, startTransition] = useTransition();
  const active = insights.filter((i) => !i.dismissedAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {state.error && <p className="text-sm text-error">{state.error}</p>}
          {state.success && <p className="text-sm text-success">{state.success}</p>}
        </div>
        <form action={formAction}>
          <Button type="submit" disabled={pending || !hasProvider}>
            <Sparkles size={16} /> {pending ? "Analisando dados..." : "Gerar novos insights"}
          </Button>
        </form>
      </div>

      {!hasProvider && (
        <p className="rounded-[10px] border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          Nenhum provedor de IA conectado. Conecte OpenAI, Anthropic ou Google Gemini em Configurações → Integrações para
          gerar insights.
        </p>
      )}

      {active.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={28} />}
          title="Nenhum insight gerado ainda"
          description='Clique em "Gerar novos insights" para uma análise de riscos, oportunidades e recomendações a partir dos dados reais da organização.'
        />
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((i) => (
            <div key={i.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ALERT_SEVERITY_TONE[i.severity as (typeof ALERT_SEVERITIES)[number]]}>
                    {ALERT_SEVERITY_LABELS[i.severity as (typeof ALERT_SEVERITIES)[number]]}
                  </Badge>
                  <Badge tone="neutral">{i.type}</Badge>
                </div>
                <p className="mt-1.5 text-sm font-medium text-text-primary">{i.title}</p>
                <p className="text-sm text-text-secondary">{i.description}</p>
                <p className="mt-1 text-xs text-text-tertiary">Gerado em {formatDateTime(new Date(i.generatedAt))} pela Lumi AI</p>
              </div>
              <button
                type="button"
                onClick={() => startTransition(() => dismissInsightAction(i.id))}
                className="shrink-0 rounded-[8px] p-1.5 text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
                aria-label="Dispensar"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
