"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { TEAM_MEMBER_TYPES, TEAM_MEMBER_TYPE_LABELS } from "@/lib/validation/team";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validation/shared";
import { PAY_DAY_MODE_LABELS, type PayDayMode } from "@/lib/payroll/business-days";
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
  paymentDayMode: string;
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
  const [mode, setMode] = useState<PayDayMode>((defaultValues?.paymentDayMode as PayDayMode) ?? "BUSINESS_DAY");

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <Input
        label="Salário fixo mensal (R$)"
        name="paymentValue"
        type="number"
        min={0}
        step="0.01"
        defaultValue={defaultValues?.paymentValue ?? ""}
        placeholder="Deixe em branco se recebe só comissão ou extras"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
        <Select label="Quando pagar" name="paymentDayMode" value={mode} onChange={(e) => setMode(e.target.value as PayDayMode)}>
          {(Object.keys(PAY_DAY_MODE_LABELS) as PayDayMode[]).map((k) => (
            <option key={k} value={k}>
              {PAY_DAY_MODE_LABELS[k]}
            </option>
          ))}
        </Select>
        {mode !== "LAST_BUSINESS_DAY" && (
          <Input
            key={mode}
            label={mode === "BUSINESS_DAY" ? "Qual dia útil" : "Dia do mês"}
            name="paymentDay"
            type="number"
            min={1}
            max={mode === "BUSINESS_DAY" ? 23 : 31}
            defaultValue={defaultValues?.paymentDay ?? 5}
          />
        )}
      </div>
      <p className="-mt-2 text-xs text-text-tertiary">
        O que a pessoa ganha no mês (fixo, comissões e extras) é pago nessa data do mês seguinte. Dias úteis já descontam fins de semana e feriados nacionais.
      </p>

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
          className="h-4 w-4 rounded border-border bg-card accent-[var(--lh-accent)]"
        />
        Ativo
      </label>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
