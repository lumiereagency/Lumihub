"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { createTaskAction, updateTaskStatusAction } from "@/lib/actions/task-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/validation/tasks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeName: string | null;
}

const STATUS_TONE: Record<string, "success" | "neutral" | "info" | "warning"> = {
  A_FAZER: "neutral",
  EM_ANDAMENTO: "info",
  EM_REVISAO: "warning",
  CONCLUIDA: "success",
};

const initialState: ActionState = {};

function QuickAddTaskForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(createTaskAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef(state.success);

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      formRef.current?.reset();
    }
    successRef.current = state.success;
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <FormMessage error={state.error} />
      <div className="flex gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <Input name="title" placeholder="Nova tarefa..." required className="flex-1" />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adicionando..." : "Adicionar"}
        </Button>
      </div>
    </form>
  );
}

export function ProjectTasks({ projectId, tasks, canCreate, canEdit }: { projectId: string; tasks: TaskRow[]; canCreate: boolean; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {tasks.length === 0 ? (
        <EmptyState title="Nenhuma tarefa neste projeto" />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="text-text-primary">{t.title}</p>
                <p className="text-xs text-text-tertiary">{t.assigneeName ?? "Sem responsável"}</p>
              </div>
              {canEdit ? (
                <select
                  value={t.status}
                  disabled={pending}
                  onChange={(e) => startTransition(() => updateTaskStatusAction(t.id, e.target.value))}
                  className="h-8 rounded-[8px] border border-border bg-card-elevated px-2 text-xs text-text-secondary"
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>
                  {TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? t.status}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {canCreate && <QuickAddTaskForm projectId={projectId} />}
    </div>
  );
}
