"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { TEAM_MEMBER_TYPES, TEAM_MEMBER_TYPE_LABELS } from "@/lib/validation/team";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validation/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface TeamMemberFormValues {
  name: string;
  role: string;
  type: string;
  userId: string | null;
  paymentValue: number | null;
  paymentMethod: string | null;
  paymentDay: number | null;
  active: boolean;
}

const initialState: ActionState = {};

export function TeamMemberForm({
  action,
  defaultValues,
  availableUsers,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: TeamMemberFormValues;
  availableUsers: { id: string; name: string }[];
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

      <Input label="Nome" name="name" required defaultValue={defaultValues?.name} />
      <Input label="Função" name="role" required defaultValue={defaultValues?.role} placeholder="Ex: Editor de vídeo, Social Media..." />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Tipo" name="type" defaultValue={defaultValues?.type ?? "FUNCIONARIO"}>
          {TEAM_MEMBER_TYPES.map((t) => (
            <option key={t} value={t}>
              {TEAM_MEMBER_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select label="Usuário do sistema (opcional)" name="userId" defaultValue={defaultValues?.userId ?? ""}>
          <option value="">Sem login no sistema</option>
          {availableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Valor de pagamento (R$)"
          name="paymentValue"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaultValues?.paymentValue ?? ""}
          className="col-span-2"
        />
        <Input
          label="Dia de pagamento"
          name="paymentDay"
          type="number"
          min={1}
          max={31}
          defaultValue={defaultValues?.paymentDay ?? ""}
        />
      </div>

      <Select label="Forma de pagamento" name="paymentMethod" defaultValue={defaultValues?.paymentMethod ?? ""}>
        <option value="">Não definida</option>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          name="active"
          defaultChecked={defaultValues?.active ?? true}
          className="h-4 w-4 rounded border-border bg-card accent-[#E8540A]"
        />
        Ativo
      </label>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
