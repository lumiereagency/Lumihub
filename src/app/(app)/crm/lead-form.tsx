"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/validation/crm";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface LeadFormValues {
  company: string;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  city: string | null;
  segment: string | null;
  source: string | null;
  ownerUserId: string | null;
  potentialValue: number | null;
  probability: number;
  stage: string;
  nextContactAt: string | null;
  notes: string | null;
}

const initialState: ActionState = {};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function LeadForm({
  action,
  defaultValues,
  users,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: LeadFormValues;
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

      <Input label="Empresa" name="company" required defaultValue={defaultValues?.company} placeholder="Nome da empresa" />
      <Input label="Responsável (contato)" name="contactName" defaultValue={defaultValues?.contactName ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Telefone" name="phone" defaultValue={defaultValues?.phone ?? ""} />
        <Input label="WhatsApp" name="whatsapp" defaultValue={defaultValues?.whatsapp ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Instagram" name="instagram" defaultValue={defaultValues?.instagram ?? ""} />
        <Input label="Site" name="website" defaultValue={defaultValues?.website ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Cidade" name="city" defaultValue={defaultValues?.city ?? ""} />
        <Input label="Segmento" name="segment" defaultValue={defaultValues?.segment ?? ""} />
      </div>

      <Input label="Origem" name="source" defaultValue={defaultValues?.source ?? ""} placeholder="Indicação, Instagram, site..." />

      <Select label="Responsável comercial" name="ownerUserId" defaultValue={defaultValues?.ownerUserId ?? ""}>
        <option value="">Sem responsável</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Valor potencial (R$)"
          name="potentialValue"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaultValues?.potentialValue ?? ""}
        />
        <Input
          label="Probabilidade (%)"
          name="probability"
          type="number"
          min={0}
          max={100}
          defaultValue={defaultValues?.probability ?? 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Estágio" name="stage" defaultValue={defaultValues?.stage ?? "LEAD"}>
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STAGE_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input
          label="Próximo contato"
          name="nextContactAt"
          type="date"
          defaultValue={toDateInputValue(defaultValues?.nextContactAt ?? null)}
        />
      </div>

      <Textarea label="Observações" name="notes" defaultValue={defaultValues?.notes ?? ""} />

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
