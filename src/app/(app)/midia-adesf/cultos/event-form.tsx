"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { toBrazilDateTimeInputValue } from "@/lib/datetime";
import { useRequirementRows, RequirementsPickerFields } from "@/components/media/event-requirements-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

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

      <RequirementsPickerFields rows={rows} onChange={updateRow} />

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
