"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCreditCardAction } from "@/lib/actions/card-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function CardForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState(createCreditCardAction, initialState);
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

      <Input label="Nome do cartão" name="name" required placeholder="Ex: Nubank Empresarial" />
      <Input label="Instituição (opcional)" name="institution" placeholder="Ex: Nubank" />
      <Input label="Limite (R$, opcional)" name="limitAmount" type="number" min={0} step="0.01" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Dia de fechamento" name="closingDay" type="number" min={1} max={31} required placeholder="Ex: 20" />
        <Input label="Dia de vencimento" name="dueDay" type="number" min={1} max={31} required placeholder="Ex: 27" />
      </div>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : "Cadastrar cartão"}
      </Button>
    </form>
  );
}
