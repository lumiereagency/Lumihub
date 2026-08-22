"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/validation/tasks";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface TaskFormValues {
  title: string;
  description: string | null;
  projectId: string | null;
  assigneeUserId: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
}

const initialState: ActionState = {};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function TaskForm({
  action,
  defaultValues,
  projects,
  users,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: TaskFormValues;
  projects: { id: string; name: string }[];
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

      <Input label="Título" name="title" required defaultValue={defaultValues?.title} />
      <Textarea label="Descrição" name="description" defaultValue={defaultValues?.description ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Projeto (opcional)" name="projectId" defaultValue={defaultValues?.projectId ?? ""}>
          <option value="">Sem projeto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select label="Responsável" name="assigneeUserId" defaultValue={defaultValues?.assigneeUserId ?? ""}>
          <option value="">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Select label="Status" name="status" defaultValue={defaultValues?.status ?? "A_FAZER"}>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select label="Prioridade" name="priority" defaultValue={defaultValues?.priority ?? "MEDIA"}>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
        <Input label="Prazo" name="dueDate" type="date" defaultValue={toDateInputValue(defaultValues?.dueDate ?? null)} />
      </div>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
