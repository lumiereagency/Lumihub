"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import type { QuoteBreakdown } from "@/lib/pricing/engine";

// Resumo de valores da proposta. "Valores da maquininha" é interno: quanto
// digitar no modo "parcelado cliente" e quanto cai líquido na conta.
export function QuoteSummary({ quote, compact = false }: { quote: QuoteBreakdown; compact?: boolean }) {
  const [internal, setInternal] = useState(false);
  const money = (v: number) => formatCurrency(v, quote.currency);
  const empty = !quote.oneTime && !quote.monthly;

  if (empty) return <p className="text-sm text-text-tertiary">Adicione serviços para ver os valores.</p>;

  return (
    <div className="flex flex-col gap-4">
      {quote.monthly && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">Mensalidade{quote.minMonths ? ` · mínimo ${quote.minMonths} meses` : ""}</p>
          <Row label="Pix" value={`${money(quote.monthly.pix)}/mês`} strong />
          {quote.monthly.card != null && (
            <Row
              label="Cartão"
              value={`${money(quote.monthly.card + quote.monthly.pixOnly)}/mês`}
              hint={internal && quote.monthly.cardNet != null ? `líquido ${money(quote.monthly.cardNet)}` : undefined}
            />
          )}
          {quote.monthly.pixOnly > 0 && quote.monthly.card != null && <p className="text-xs text-text-tertiary">{money(quote.monthly.pixOnly)}/mês só no Pix</p>}
        </div>
      )}

      {quote.oneTime && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{quote.monthly ? "Projeto (pagamento único)" : "Pagamento"}</p>
          <Row label={quote.currency === "BRL" ? "Pix" : "À vista"} value={money(quote.oneTime.pix)} strong />
          {quote.oneTime.debit != null && (
            <Row label="Débito" value={money(quote.oneTime.debit + quote.oneTime.pixOnly)} hint={internal && quote.oneTime.debitNet != null ? `líquido ${money(quote.oneTime.debitNet)}` : undefined} />
          )}
          {quote.oneTime.credit.length > 0 && (
            <div className={cn("mt-1 overflow-hidden rounded-2xl border border-border", compact && "max-h-[280px] overflow-y-auto")}>
              <table className="w-full text-sm">
                <thead className="bg-card-elevated/60 text-[11px] text-text-tertiary">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Crédito</th>
                    <th className="px-3 py-2 text-right font-medium">Cliente paga</th>
                    {internal && <th className="px-3 py-2 text-right font-medium">Digitar</th>}
                    {internal && <th className="px-3 py-2 text-right font-medium">Líquido</th>}
                  </tr>
                </thead>
                <tbody className="lb-figures">
                  {quote.oneTime.credit.map((c) => (
                    <tr key={c.n} className="border-t border-border">
                      <td className="px-3 py-1.5 text-text-secondary">{c.n}x</td>
                      <td className="px-3 py-1.5 text-right text-text-primary">
                        {c.n === 1 ? money(c.total) : money(c.installment)}
                        {c.n > 1 && !internal && <span className="ml-1 text-[11px] text-text-tertiary">({money(c.total)})</span>}
                      </td>
                      {internal && <td className="px-3 py-1.5 text-right text-text-secondary">{money(c.machine)}</td>}
                      {internal && <td className="px-3 py-1.5 text-right text-success">{money(c.net)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {quote.oneTime.pixOnly > 0 && quote.oneTime.debit != null && <p className="text-xs text-text-tertiary">{money(quote.oneTime.pixOnly)} só no Pix (itens sem cartão)</p>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <div>
          <p className="text-xs text-text-tertiary">Valor do contrato (Pix)</p>
          <p className="lb-figures text-lg font-semibold tracking-tight text-text-primary">{money(quote.contractValue)}</p>
        </div>
        {quote.currency === "BRL" && (quote.oneTime?.credit.length || quote.monthly?.card != null) ? (
          <button
            type="button"
            onClick={() => setInternal((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-text-secondary hover:text-text-primary"
            aria-pressed={internal}
          >
            {internal ? <EyeOff size={14} /> : <Eye size={14} />} Maquininha
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 rounded-xl px-3 py-2", strong ? "bg-success/10" : "bg-card-elevated/50")}>
      <span className={cn("text-sm", strong ? "font-medium text-success" : "text-text-secondary")}>{label}</span>
      <span className="text-right">
        <span className={cn("lb-figures text-sm", strong ? "font-semibold text-success" : "text-text-primary")}>{value}</span>
        {hint && <span className="block text-[11px] text-text-tertiary">{hint}</span>}
      </span>
    </div>
  );
}
