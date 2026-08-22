"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/validation/projects";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface ProjectFormValues {
  clientId: string;
  name: string;
  responsibleUserId: string | null;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  value: number | null;
  costEstimate: number | null;
}

const initialState: ActionState = {};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ProjectForm({
  action,
  defaultValues,
  clients,
  users,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: ProjectFormValues;
  clients: { id: string; companyName: string }[];
  users: { id: string; name: string }[];
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

      <Input label="Nome do projeto" name="name" required defaultValue={defaultValues?.name} placeholder="Ex: Campanha de lançamento" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Responsável" name="responsibleUserId" defaultValue={defaultValues?.responsibleUserId ?? ""}>
          <option value="">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select label="Status" name="status" defaultValue={defaultValues?.status ?? "BACKLOG"}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Início" name="startDate" type="date" defaultValue={toDateInputValue(defaultValues?.startDate ?? null)} />
        <Input label="Prazo" name="dueDate" type="date" defaultValue={toDateInputValue(defaultValues?.dueDate ?? null)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor (R$)" name="value" type="number" min={0} step="0.01" defaultValue={defaultValues?.value ?? ""} />
        <Input label="Custo estimado (R$)" name="costEstimate" type="number" min={0} step="0.01" defaultValue={defaultValues?.costEstimate ?? ""} />
      </div>
      <p className="-mt-2 text-xs text-text-tertiary">Definir um prazo cria automaticamente um evento de entrega na Agenda.</p>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
