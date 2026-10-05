import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { MonthResult } from "@/lib/finance/taxes";

// "O que sobra de verdade": recebido − imposto − custos − equipe.
export function MonthResultPanel({ r, href, compact = false }: { r: MonthResult; href?: string; compact?: boolean }) {
  const steps = [
    { label: "Recebido", value: r.received, sign: "", hint: r.expectedIncome > r.received ? `${formatCurrency(r.expectedIncome)} previsto no mês` : "entrou no caixa" },
    { label: `Imposto (${r.taxRate.toLocaleString("pt-BR")}%)`, value: -r.taxes, sign: "−", hint: "reserva do Simples" },
    { label: "Custos", value: -r.costs, sign: "−", hint: "contas do mês" },
    { label: "Equipe", value: -r.team, sign: "−", hint: "folha do mês" },
  ];
  const max = Math.max(r.received, r.taxes + r.costs + r.team, 1);
  const label = r.label.charAt(0).toUpperCase() + r.label.slice(1);
  const body = (
    <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold tracking-tight text-text-primary">O que sobra de verdade · {label}</p>
          <p className="text-sm text-text-tertiary">Recebido menos imposto, custos e equipe</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-tertiary">Sobra para você</p>
          <p className={`lb-figures text-[28px] font-semibold leading-tight tracking-tight ${r.profit < 0 ? "text-error" : "bg-[image:var(--lh-accent-gradient)] bg-clip-text text-transparent"}`}>{formatCurrency(r.profit)}</p>
          {r.margin !== null && <p className="text-xs text-text-tertiary">{r.margin.toLocaleString("pt-BR")}% do que entrou</p>}
        </div>
      </div>
      <div className={`grid gap-3 ${compact ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"}`}>
        {steps.map((s, i) => (
          <div key={s.label} className="flex flex-col gap-2 rounded-2xl bg-card-elevated/60 p-3">
            <p className="text-xs text-text-tertiary">{s.label}</p>
            <p className={`lb-figures text-lg font-semibold ${i === 0 ? "text-text-primary" : "text-text-secondary"}`}>
              {s.sign}
              {formatCurrency(Math.abs(s.value))}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div className={`h-full rounded-full ${i === 0 ? "bg-[image:var(--lh-accent-gradient)]" : "bg-text-tertiary/60"}`} style={{ width: `${Math.round((Math.abs(s.value) / max) * 100)}%` }} />
            </div>
            <p className="text-[11px] text-text-tertiary">{s.hint}</p>
          </div>
        ))}
      </div>
      {href && (
        <span className="flex items-center gap-1 text-xs text-text-secondary">
          Ver o financeiro do mês <ArrowRight size={13} />
        </span>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-95">
      {body}
    </Link>
  ) : (
    body
  );
}
