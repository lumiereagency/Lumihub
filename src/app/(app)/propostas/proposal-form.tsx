"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface ProposalFormValues {
  title: string;
  leadId: string | null;
  clientId: string | null;
  value: number;
  validUntil: string | null;
  notes: string | null;
}

const initialState: ActionState = {};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ProposalForm({
  action,
  defaultValues,
  leads,
  clients,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: ProposalFormValues;
  leads: { id: string; company: string }[];
  clients: { id: string; companyName: string }[];
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

      <Input label="Título" name="title" required defaultValue={defaultValues?.title} placeholder="Ex: Cobertura de evento corporativo" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Lead" name="leadId" defaultValue={defaultValues?.leadId ?? ""}>
          <option value="">Sem lead vinculado</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.company}
            </option>
          ))}
        </Select>
        <Select label="Cliente" name="clientId" defaultValue={defaultValues?.clientId ?? ""}>
          <option value="">Sem cliente vinculado</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </div>
      <p className="-mt-2 text-xs text-text-tertiary">Vincule a pelo menos um lead ou cliente.</p>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor (R$)" name="value" type="number" min={0.01} step="0.01" required defaultValue={defaultValues?.value} />
        <Input label="Válida até" name="validUntil" type="date" defaultValue={toDateInputValue(defaultValues?.validUntil ?? null)} />
      </div>

      <Textarea label="Observações / escopo" name="notes" defaultValue={defaultValues?.notes ?? ""} />

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
