"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCardTransactionAction } from "@/lib/actions/card-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({ cardId, onSuccess }: { cardId: string; onSuccess?: () => void }) {
  const action = createCardTransactionAction.bind(null, cardId);
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

      <Input label="Descrição" name="description" required placeholder="Ex: Equipamento de câmera" />
      <Input label="Categoria (opcional)" name="category" placeholder="Ex: Equipamentos" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor total (R$)" name="totalAmount" type="number" min={0.01} step="0.01" required />
        <Input label="Data da compra" name="purchaseDate" type="date" required defaultValue={todayInputValue()} />
      </div>

      <Input label="Número de parcelas" name="installmentsTotal" type="number" min={1} max={24} defaultValue={1} />
      <p className="-mt-2 text-xs text-text-tertiary">As parcelas são distribuídas automaticamente nas faturas seguintes, considerando o fechamento do cartão.</p>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : "Lançar compra"}
      </Button>
    </form>
  );
}
