"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS } from "@/lib/validation/clients";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface ClientFormValues {
  companyName: string;
  cnpj: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  instagram: string | null;
  website: string | null;
  status: string;
  notes: string | null;
}

const initialState: ActionState = {};

export function ClientForm({
  action,
  defaultValues,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: ClientFormValues;
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

      <Input label="Empresa" name="companyName" required defaultValue={defaultValues?.companyName} placeholder="Nome da empresa" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="CNPJ" name="cnpj" defaultValue={defaultValues?.cnpj ?? ""} />
        <Select label="Status" name="status" defaultValue={defaultValues?.status ?? "ATIVO"}>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLIENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <Input label="Responsável (contato)" name="contactName" defaultValue={defaultValues?.contactName ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="E-mail" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
        <Input label="Telefone" name="phone" defaultValue={defaultValues?.phone ?? ""} />
      </div>

      <Input label="Endereço" name="address" defaultValue={defaultValues?.address ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Instagram" name="instagram" defaultValue={defaultValues?.instagram ?? ""} />
        <Input label="Site" name="website" defaultValue={defaultValues?.website ?? ""} />
      </div>

      <Textarea label="Observações" name="notes" defaultValue={defaultValues?.notes ?? ""} />

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
