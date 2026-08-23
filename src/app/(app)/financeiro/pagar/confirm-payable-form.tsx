"use client";

import { useActionState } from "react";
import { confirmPayablePaymentAction } from "@/lib/actions/payable-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ConfirmPayableForm({ payableId }: { payableId: string }) {
  const [state, formAction, pending] = useActionState(confirmPayablePaymentAction.bind(null, payableId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-[10px] border border-border bg-bg-secondary p-4">
      <p className="text-sm font-medium text-text-primary">Confirmar pagamento</p>
      <FormMessage error={state.error} success={state.success} />
      <Input label="Data de pagamento" name="paidAt" type="date" required defaultValue={todayInputValue()} />
      <Button type="submit" disabled={pending}>
        {pending ? "Confirmando..." : "Confirmar pagamento"}
      </Button>
    </form>
  );
}
