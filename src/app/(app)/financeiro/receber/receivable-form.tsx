"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validation/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface ReceivableFormValues {
  clientId: string;
  contractId: string | null;
  description: string;
  amount: number;
  dueDate: string;
  paymentMethod: string | null;
  notes: string | null;
}

const initialState: ActionState = {};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ReceivableForm({
  action,
  defaultValues,
  clients,
  contracts,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: ReceivableFormValues;
  clients: { id: string; companyName: string }[];
  contracts: { id: string; title: string; clientId: string }[];
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

      <Select label="Contrato (opcional)" name="contractId" defaultValue={defaultValues?.contractId ?? ""}>
        <option value="">Sem contrato</option>
        {contracts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </Select>

      <Input label="Descrição" name="description" required defaultValue={defaultValues?.description} placeholder="Ex: Mensalidade de setembro" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor (R$)" name="amount" type="number" min={0.01} step="0.01" required defaultValue={defaultValues?.amount} />
        <Input label="Vencimento" name="dueDate" type="date" required defaultValue={toDateInputValue(defaultValues?.dueDate ?? null)} />
      </div>

      <Select label="Forma de pagamento" name="paymentMethod" defaultValue={defaultValues?.paymentMethod ?? ""}>
        <option value="">Não definida</option>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>

      <Textarea label="Observações" name="notes" defaultValue={defaultValues?.notes ?? ""} />

      <p className="-mt-2 text-xs text-text-tertiary">
        Os lembretes da régua de cobrança são gerados automaticamente a partir dos modelos ativos.
      </p>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
