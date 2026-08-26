"use client";

import { useActionState, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { useRequirementRows, RequirementsPickerFields } from "@/components/media/event-requirements-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};
const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export interface RecurrenceFormValues {
  name: string;
  type: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  requirements: { functionId: string; requiredQuantity: number; mandatory: boolean }[];
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// As funções escolhidas aqui viram o template da série (§ pedido do
// usuário: "eu preciso das opções das funções... para criar isso em massa
// como padrão") — toda ocorrência gerada por esta recorrência já nasce com
// elas, em vez de cair no template genérico da organização. No modo de
// edição, salvar também sincroniza nome/tipo/local/horário e funções com
// as ocorrências futuras já geradas (§ "editar não estava obedecendo o
// horário ser o mesmo em todas").
export function RecurrenceForm({
  action,
  defaultValues,
  allFunctions,
  submitLabel,
  onSuccess,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: RecurrenceFormValues;
  allFunctions: { id: string; name: string }[];
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const { rows, updateRow, toRequirementsJSON } = useRequirementRows(allFunctions, defaultValues?.requirements);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        if (hiddenRef.current) hiddenRef.current.value = toRequirementsJSON();
      }}
      className="flex flex-col gap-4"
    >
      <input ref={hiddenRef} type="hidden" name="requirementsJson" />
      <FormMessage error={state.error} success={state.success} />
      <Input label="Nome da série" name="name" required placeholder="Culto de Domingo à Noite" defaultValue={defaultValues?.name} />
      <Input label="Tipo" name="type" defaultValue={defaultValues?.type ?? "Culto"} />
      <div className="grid grid-cols-3 gap-3">
        <Select label="Dia da semana" name="dayOfWeek" defaultValue={String(defaultValues?.dayOfWeek ?? 0)}>
          {DAY_LABELS.map((label, i) => (
            <option key={i} value={i}>
              {label}
            </option>
          ))}
        </Select>
        <Input label="Início" name="startTime" type="time" defaultValue={defaultValues?.startTime ?? "19:00"} required />
        <Input label="Fim (opcional)" name="endTime" type="time" defaultValue={defaultValues?.endTime ?? ""} />
      </div>
      <Input label="Local (opcional)" name="location" defaultValue={defaultValues?.location ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="A partir de"
          name="startDate"
          type="date"
          required
          defaultValue={defaultValues ? toDateInputValue(defaultValues.startDate) : undefined}
        />
        <Input
          label="Até (opcional)"
          name="endDate"
          type="date"
          defaultValue={defaultValues?.endDate ? toDateInputValue(defaultValues.endDate) : ""}
        />
      </div>

      <RequirementsPickerFields rows={rows} onChange={updateRow} label="Funções necessárias em cada ocorrência" />

      <p className="text-xs text-text-tertiary">
        {defaultValues
          ? "Ao salvar, as ocorrências futuras já geradas são atualizadas com estes dados."
          : "As próximas ocorrências (até 90 dias) são geradas automaticamente ao criar a série."}
      </p>
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
      {state.success && onSuccess && (
        <Button type="button" variant="secondary" onClick={onSuccess}>
          Fechar
        </Button>
      )}
    </form>
  );
}
