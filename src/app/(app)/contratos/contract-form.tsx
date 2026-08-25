"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  RECURRENCE_TYPES,
  RECURRENCE_LABELS,
} from "@/lib/validation/contracts";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface ContractFormValues {
  clientId: string;
  templateId: string | null;
  title: string;
  type: string;
  value: number;
  recurrence: string;
  startDate: string;
  endDate: string | null;
  paymentDay: number | null;
  status: string;
}

const initialState: ActionState = {};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ContractForm({
  action,
  defaultValues,
  clients,
  templates,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: ContractFormValues;
  clients: { id: string; companyName: string }[];
  templates: { id: string; name: string }[];
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

      <Select label="Cliente" name="clientId" required defaultValue={defaultValues?.clientId ?? ""}>
        <option value="" disabled>
          Selecione um cliente
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.companyName}
          </option>
        ))}
      </Select>

      <Input label="Título do contrato" name="title" required defaultValue={defaultValues?.title} placeholder="Ex: Gestão de Social Media — 2026" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Tipo" name="type" defaultValue={defaultValues?.type ?? "CLIENTE"}>
          {CONTRACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTRACT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select label="Modelo (opcional)" name="templateId" defaultValue={defaultValues?.templateId ?? ""}>
          <option value="">Sem modelo</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor (R$)" name="value" type="number" min={0.01} step="0.01" required defaultValue={defaultValues?.value} />
        <Select label="Recorrência" name="recurrence" defaultValue={defaultValues?.recurrence ?? "UNICO"}>
          {RECURRENCE_TYPES.map((r) => (
            <option key={r} value={r}>
              {RECURRENCE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Início"
          name="startDate"
          type="date"
          required
          defaultValue={toDateInputValue(defaultValues?.startDate ?? null)}
        />
        <Input label="Término (opcional)" name="endDate" type="date" defaultValue={toDateInputValue(defaultValues?.endDate ?? null)} />
      </div>
      <p className="-mt-2 text-xs text-text-tertiary">Início e término só contam a duração do contrato — não geram cobrança sozinhos.</p>

      <Input
        label="Dia do pagamento (opcional)"
        name="paymentDay"
        type="number"
        min={1}
        max={31}
        placeholder="Ex: 10"
        defaultValue={defaultValues?.paymentDay ?? ""}
      />
      <p className="-mt-2 text-xs text-text-tertiary">
        Dia do mês em que a cobrança vence — é o que decide se ela está pendente ou atrasada. Sem esse dia, a
        cobrança usa o Início como referência.
      </p>

      <Select label="Status" name="status" defaultValue={defaultValues?.status ?? "RASCUNHO"}>
        {CONTRACT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {CONTRACT_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <p className="-mt-2 text-xs text-text-tertiary">
        Ao marcar o contrato como Ativo, a primeira cobrança é gerada automaticamente em Contas a Receber.
      </p>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
