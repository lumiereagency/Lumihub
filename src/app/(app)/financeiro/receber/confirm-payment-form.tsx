"use client";

import { useActionState } from "react";
import { confirmPaymentAction } from "@/lib/actions/receivable-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validation/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ConfirmPaymentForm({ receivableId, defaultPaymentMethod }: { receivableId: string; defaultPaymentMethod: string | null }) {
  const [state, formAction, pending] = useActionState(confirmPaymentAction.bind(null, receivableId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-[10px] border border-border bg-bg-secondary p-4">
      <p className="text-sm font-medium text-text-primary">Confirmar pagamento</p>
      <FormMessage error={state.error} success={state.success} />

      <Input label="Data de pagamento" name="paidAt" type="date" required defaultValue={todayInputValue()} />

      <Select label="Forma de pagamento" name="paymentMethod" defaultValue={defaultPaymentMethod ?? ""}>
        <option value="">Não informada</option>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>

      <Input label="Link do comprovante (opcional)" name="proofUrl" type="url" placeholder="https://..." />

      <Button type="submit" disabled={pending}>
        {pending ? "Confirmando..." : "Confirmar pagamento"}
      </Button>
    </form>
  );
}
