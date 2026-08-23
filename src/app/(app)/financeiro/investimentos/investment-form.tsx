"use client";

import { useActionState, useEffect, useRef } from "react";
import { createInvestmentAction } from "@/lib/actions/investment-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { INVESTMENT_CATEGORIES } from "@/lib/validation/investments";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validation/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InvestmentForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState(createInvestmentAction, initialState);
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

      <Input label="Descrição" name="description" required placeholder="Ex: Câmera Sony A7IV" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Categoria" name="category" defaultValue={INVESTMENT_CATEGORIES[0]}>
          {INVESTMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input label="Data" name="date" type="date" required defaultValue={todayInputValue()} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor (R$)" name="amount" type="number" min={0.01} step="0.01" required />
        <Input label="Parcelas" name="installments" type="number" min={1} max={60} defaultValue={1} />
      </div>

      <Select label="Forma de pagamento" name="paymentMethod" defaultValue="">
        <option value="">Não definida</option>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </Select>

      <Input label="Objetivo (opcional)" name="objective" placeholder="Ex: Aumentar qualidade de produção" />
      <Input label="Retorno esperado (opcional)" name="expectedReturn" placeholder="Ex: Redução de custo de terceirização" />
      <Textarea label="Observações" name="notes" />

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : "Registrar investimento"}
      </Button>
    </form>
  );
}
