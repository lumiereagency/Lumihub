"use client";

import { useActionState, useEffect, useRef } from "react";
import { createGoalAction } from "@/lib/actions/goal-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { GOAL_TYPES, GOAL_TYPE_LABELS, GOAL_SCENARIOS, GOAL_SCENARIO_LABELS } from "@/lib/validation/goals";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function GoalForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState(createGoalAction, initialState);
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

      <Select label="Tipo de meta" name="type" defaultValue={GOAL_TYPES[0]}>
        {GOAL_TYPES.map((t) => (
          <option key={t} value={t}>
            {GOAL_TYPE_LABELS[t]}
          </option>
        ))}
      </Select>

      <Select label="Cenário" name="scenario" defaultValue="REALISTA">
        {GOAL_SCENARIOS.map((s) => (
          <option key={s} value={s}>
            {GOAL_SCENARIO_LABELS[s]}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Início do período" name="periodStart" type="date" required />
        <Input label="Fim do período" name="periodEnd" type="date" required />
      </div>

      <Input label="Valor da meta" name="targetValue" type="number" min={0.01} step="0.01" required placeholder="Ex: 50000 (R$), 10 (clientes), 25 (margem %)" />
      <p className="-mt-2 text-xs text-text-tertiary">
        Para Faturamento e Recebimentos, informe um valor em reais. Para Novos clientes, Prospecção e Projetos, informe uma quantidade. Para Margem, informe um percentual (ex: 25 para 25%).
      </p>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : "Criar meta"}
      </Button>
    </form>
  );
}
