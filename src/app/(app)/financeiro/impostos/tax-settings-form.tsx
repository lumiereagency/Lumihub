"use client";

import { useState, useTransition } from "react";
import { updateTaxSettingsAction } from "@/lib/actions/payroll-actions";
import { Button } from "@/components/ui/button";

export function TaxSettingsForm({ rate, dueDay }: { rate: number; dueDay: number }) {
  const [values, setValues] = useState({ taxRate: rate, taxDueDay: dueDay });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-text-tertiary">Alíquota sobre o recebido</span>
        <span className="flex items-center gap-2 rounded-xl border border-border bg-card-elevated px-3">
          <input type="number" step="0.01" min={0} max={50} value={values.taxRate} onChange={(e) => setValues((v) => ({ ...v, taxRate: Number(e.target.value) }))} className="lb-figures h-10 w-24 bg-transparent text-sm text-text-primary focus:outline-none" />
          <span className="text-sm text-text-tertiary">%</span>
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-text-tertiary">Dia do vencimento do DAS</span>
        <input type="number" min={1} max={28} value={values.taxDueDay} onChange={(e) => setValues((v) => ({ ...v, taxDueDay: Number(e.target.value) }))} className="lb-figures h-10 w-24 rounded-xl border border-border bg-card-elevated px-3 text-sm text-text-primary focus:outline-none" />
      </label>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await updateTaxSettingsAction(values);
            setMsg(r.ok ? "Salvo e recalculado." : (r.error ?? "Não foi possível salvar."));
          })
        }
      >
        {pending ? "Salvando…" : "Salvar"}
      </Button>
      {msg && <span className="text-xs text-text-secondary">{msg}</span>}
    </div>
  );
}
