"use client";

import { useActionState } from "react";
import { updateMediaAIWeightsAction } from "@/lib/actions/media-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

// Painel de configuração dos pesos da IA (§8): disponibilidade, habilitação
// e ausência de conflito NUNCA aparecem aqui — são obrigatórias e nunca
// configuráveis. Só os critérios preferenciais (carga, recência,
// preferência) têm peso ajustável; 0 desliga o critério.
export function AIWeightsForm({
  aiWeightWorkload,
  aiWeightRecency,
  aiWeightPreference,
  aiMinRestDays,
}: {
  aiWeightWorkload: number;
  aiWeightRecency: number;
  aiWeightPreference: number;
  aiMinRestDays: number;
}) {
  const [state, formAction, pending] = useActionState(updateMediaAIWeightsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <FormMessage error={state.error} success={state.success} />
      <p className="text-sm text-text-tertiary">
        Ajuste o peso relativo de cada critério preferencial da IA de escala. Restrições obrigatórias (ativo, habilitado, disponível, sem
        conflito) nunca são configuráveis — a IA nunca escala quem não passa nelas.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input label="Carga de trabalho" name="aiWeightWorkload" type="number" min={0} max={100} defaultValue={aiWeightWorkload} />
        <Input label="Recência" name="aiWeightRecency" type="number" min={0} max={100} defaultValue={aiWeightRecency} />
        <Input label="Preferência (função primária)" name="aiWeightPreference" type="number" min={0} max={100} defaultValue={aiWeightPreference} />
      </div>
      <Input
        label="Descanso mínimo entre escalas (dias)"
        name="aiMinRestDays"
        type="number"
        min={0}
        max={90}
        defaultValue={aiMinRestDays}
        hint="A IA evita escalar o mesmo membro de novo antes desse intervalo, intercalando com o resto da equipe — só ignora quando não sobra ninguém mais disponível para a vaga."
      />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar pesos"}
      </Button>
    </form>
  );
}
