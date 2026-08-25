"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { toBrazilDateTimeInputValue } from "@/lib/datetime";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

interface RequirementRow {
  functionId: string;
  functionName: string;
  included: boolean;
  requiredQuantity: number;
  mandatory: boolean;
}

export interface EventFormValues {
  name: string;
  type: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  description: string | null;
  administrativeNotes: string | null;
  requirements: { functionId: string; requiredQuantity: number; mandatory: boolean }[];
}

export function EventForm({
  action,
  defaultValues,
  allFunctions,
  submitLabel,
  onSuccess,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: EventFormValues;
  allFunctions: { id: string; name: string }[];
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const successRef = useRef(state.success);

  useEffect(() => {
    if (state.success && state.success !== successRef.current) onSuccess?.();
    successRef.current = state.success;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const [rows, setRows] = useState<RequirementRow[]>(() =>
    allFunctions.map((f) => {
      const existing = defaultValues?.requirements.find((r) => r.functionId === f.id);
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

  return (
    <form
      action={formAction}
      onSubmit={() => {
        if (hiddenRef.current) {
          hiddenRef.current.value = JSON.stringify(
            rows.filter((r) => r.included).map((r) => ({ functionId: r.functionId, requiredQuantity: r.requiredQuantity, mandatory: r.mandatory })),
          );
        }
      }}
      className="flex flex-col gap-4"
    >
      <input ref={hiddenRef} type="hidden" name="requirementsJson" />
      <FormMessage error={state.error} success={state.success} />

      <Input label="Nome" name="name" required defaultValue={defaultValues?.name} placeholder="Culto da Noite" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Tipo" name="type" defaultValue={defaultValues?.type ?? "Culto"} list="media-event-types" />
        <datalist id="media-event-types">
          <option value="Culto" />
          <option value="Culto Especial" />
          <option value="Conferência" />
          <option value="Vigília" />
          <option value="Ensaio" />
          <option value="Evento" />
          <option value="Outro" />
        </datalist>
        <Input label="Local" name="location" defaultValue={defaultValues?.location ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Início" name="startAt" type="datetime-local" required defaultValue={toBrazilDateTimeInputValue(defaultValues?.startAt ?? null)} />
        <Input label="Término (opcional)" name="endAt" type="datetime-local" defaultValue={toBrazilDateTimeInputValue(defaultValues?.endAt ?? null)} />
      </div>

      <Textarea label="Descrição (opcional)" name="description" defaultValue={defaultValues?.description ?? ""} rows={2} />
      <Textarea label="Observações administrativas (uso interno)" name="administrativeNotes" defaultValue={defaultValues?.administrativeNotes ?? ""} rows={2} />

      <div>
        <p className="mb-2 text-sm font-medium text-text-secondary">Funções necessárias</p>
        <div className="flex flex-col gap-2 rounded-[10px] border border-border p-3">
          {rows.map((row) => (
            <div key={row.functionId} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={row.included}
                onChange={(e) => updateRow(row.functionId, { included: e.target.checked })}
                className="h-4 w-4 rounded border-border bg-card accent-accent"
              />
              <span className="flex-1 text-sm text-text-primary">{row.functionName}</span>
              <input
                type="number"
                min={1}
                max={20}
                value={row.requiredQuantity}
                disabled={!row.included}
                onChange={(e) => updateRow(row.functionId, { requiredQuantity: Number(e.target.value) })}
                className="h-8 w-16 rounded-[8px] border border-border bg-card px-2 text-sm text-text-primary disabled:opacity-40"
              />
              <label className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <input
                  type="checkbox"
                  checked={row.mandatory}
                  disabled={!row.included}
                  onChange={(e) => updateRow(row.functionId, { mandatory: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-border bg-card accent-accent disabled:opacity-40"
                />
                Obrigatória
              </label>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
