"use client";

import { useState } from "react";

export interface RequirementRow {
  functionId: string;
  functionName: string;
  included: boolean;
  requiredQuantity: number;
  mandatory: boolean;
}

// Estado compartilhado do seletor de funções — usado tanto no formulário de
// um culto avulso (EventForm) quanto no de uma série recorrente
// (RecurrenceForm), para nunca duplicar essa lógica entre os dois.
export function useRequirementRows(
  allFunctions: { id: string; name: string }[],
  defaultValues?: { functionId: string; requiredQuantity: number; mandatory: boolean }[],
) {
  const [rows, setRows] = useState<RequirementRow[]>(() =>
    allFunctions.map((f) => {
      const existing = defaultValues?.find((r) => r.functionId === f.id);
      return {
        functionId: f.id,
        functionName: f.name,
        included: !!existing,
        requiredQuantity: existing?.requiredQuantity ?? 1,
        mandatory: existing?.mandatory ?? true,
      };
    }),
  );

  function updateRow(functionId: string, patch: Partial<RequirementRow>) {
    setRows((prev) => prev.map((r) => (r.functionId === functionId ? { ...r, ...patch } : r)));
  }

  function toRequirementsJSON(): string {
    return JSON.stringify(
      rows.filter((r) => r.included).map((r) => ({ functionId: r.functionId, requiredQuantity: r.requiredQuantity, mandatory: r.mandatory })),
    );
  }

  return { rows, updateRow, toRequirementsJSON };
}

export function RequirementsPickerFields({
  rows,
  onChange,
  label = "Funções necessárias",
}: {
  rows: RequirementRow[];
  onChange: (functionId: string, patch: Partial<RequirementRow>) => void;
  label?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-text-secondary">{label}</p>
      <div className="flex flex-col gap-2 rounded-[10px] border border-border p-3">
        {rows.map((row) => (
          <div key={row.functionId} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={row.included}
              onChange={(e) => onChange(row.functionId, { included: e.target.checked })}
              className="h-4 w-4 rounded border-border bg-card accent-accent"
            />
            <span className="flex-1 text-sm text-text-primary">{row.functionName}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={row.requiredQuantity}
              disabled={!row.included}
              onChange={(e) => onChange(row.functionId, { requiredQuantity: Number(e.target.value) })}
              className="h-8 w-16 rounded-[8px] border border-border bg-card px-2 text-sm text-text-primary disabled:opacity-40"
            />
            <label className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <input
                type="checkbox"
                checked={row.mandatory}
                disabled={!row.included}
                onChange={(e) => onChange(row.functionId, { mandatory: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-border bg-card accent-accent disabled:opacity-40"
              />
              Obrigatória
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
