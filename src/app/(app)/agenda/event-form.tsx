"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { MANUALLY_CREATABLE_TYPES, CALENDAR_EVENT_TYPE_LABELS } from "@/lib/validation/calendar";
import { toBrazilDateTimeInputValue } from "@/lib/datetime";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface EventFormValues {
  title: string;
  type: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  clientId: string | null;
  projectId: string | null;
  responsibleUserId: string | null;
  location: string | null;
  notes: string | null;
}

const initialState: ActionState = {};


export function EventForm({
  action,
  defaultValues,
  clients,
  projects,
  users,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: EventFormValues;
  clients: { id: string; companyName: string }[];
  projects: { id: string; name: string }[];
  users: { id: string; name: string }[];
  onSuccess?: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const successRef = useRef(state.success);

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      onSuccess?.();
    }
    successRef.current = state.success;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />

      <Input label="Título" name="title" required defaultValue={defaultValues?.title} />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Tipo" name="type" defaultValue={defaultValues?.type ?? "REUNIAO"}>
          {MANUALLY_CREATABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {CALENDAR_EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select label="Responsável" name="responsibleUserId" defaultValue={defaultValues?.responsibleUserId ?? ""}>
          <option value="">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Início" name="startAt" type="datetime-local" required defaultValue={toBrazilDateTimeInputValue(defaultValues?.startAt ?? null)} />
        <Input label="Término (opcional)" name="endAt" type="datetime-local" defaultValue={toBrazilDateTimeInputValue(defaultValues?.endAt ?? null)} />
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="allDay" defaultChecked={defaultValues?.allDay ?? false} className="h-4 w-4 rounded border-border bg-card accent-[#E8540A]" />
        Dia inteiro
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Cliente (opcional)" name="clientId" defaultValue={defaultValues?.clientId ?? ""}>
          <option value="">Nenhum</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
        <Select label="Projeto (opcional)" name="projectId" defaultValue={defaultValues?.projectId ?? ""}>
          <option value="">Nenhum</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <Input label="Local" name="location" defaultValue={defaultValues?.location ?? ""} />
      <Textarea label="Observações" name="notes" defaultValue={defaultValues?.notes ?? ""} />

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
