"use client";

import { useActionState } from "react";
import { createRecurrenceAction } from "@/lib/actions/media-event-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};
const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function RecurrenceForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState(createRecurrenceAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />
      <Input label="Nome da série" name="name" required placeholder="Culto de Domingo à Noite" />
      <Input label="Tipo" name="type" defaultValue="Culto" />
      <div className="grid grid-cols-3 gap-3">
        <Select label="Dia da semana" name="dayOfWeek" defaultValue="0">
          {DAY_LABELS.map((label, i) => (
            <option key={i} value={i}>
              {label}
            </option>
          ))}
        </Select>
        <Input label="Início" name="startTime" type="time" defaultValue="19:00" required />
        <Input label="Fim (opcional)" name="endTime" type="time" />
      </div>
      <Input label="Local (opcional)" name="location" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="A partir de" name="startDate" type="date" required />
        <Input label="Até (opcional)" name="endDate" type="date" />
      </div>
      <p className="text-xs text-text-tertiary">As próximas ocorrências (até 90 dias) são geradas automaticamente ao criar a série.</p>
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Criando..." : "Criar série recorrente"}
      </Button>
      {state.success && onSuccess && (
        <Button type="button" variant="secondary" onClick={onSuccess}>
          Fechar
        </Button>
      )}
    </form>
  );
}
