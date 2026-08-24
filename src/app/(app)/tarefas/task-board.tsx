"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, ListChecks, AlertCircle, Trash2 } from "lucide-react";
import { createTaskAction, updateTaskAction, updateTaskStatusAction, deleteTaskAction } from "@/lib/actions/task-actions";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/validation/tasks";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskForm, type TaskFormValues } from "./task-form";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
}

const PRIORITY_TONE: Record<string, "neutral" | "info" | "warning" | "error"> = {
  BAIXA: "neutral",
  MEDIA: "info",
  ALTA: "warning",
  URGENTE: "error",
};

function isOverdue(t: TaskRow): boolean {
  if (t.status === "CONCLUIDA") return false;
  if (!t.dueDate) return false;
  return new Date(t.dueDate).getTime() < Date.now();
}

function toFormValues(t: TaskRow): TaskFormValues {
  return {
    title: t.title,
    description: t.description,
    projectId: t.projectId,
    assigneeUserId: t.assigneeUserId,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
  };
}

export function TaskBoard({
  tasks,
  projects,
  users,
  permissions,
}: {
  tasks: TaskRow[];
  projects: { id: string; name: string }[];
  users: { id: string; name: string }[];
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("TODOS");
  const [, startTransition] = useTransition();

  const filtered = useMemo(
    () => (projectFilter === "TODOS" ? tasks : tasks.filter((t) => t.projectId === projectFilter)),
    [tasks, projectFilter],
  );

  const columns = useMemo(
    () => TASK_STATUSES.map((status) => ({ status, items: filtered.filter((t) => t.status === status) })),
    [filtered],
  );

  const editing = editingId ? tasks.find((t) => t.id === editingId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="TODOS">Todos os projetos</option>
          <option value="">Sem projeto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {permissions.canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Nova Tarefa
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={28} />}
          title="Nenhuma tarefa cadastrada ainda"
          action={
            permissions.canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Adicionar tarefa
              </Button>
            )
          }
        />
      ) : (
        <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
          {columns.map((col) => (
            <div key={col.status} className="flex w-72 shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-text-primary">{TASK_STATUS_LABELS[col.status]}</span>
                <span className="text-xs text-text-tertiary">{col.items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {col.items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEditingId(t.id)}
                    className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary">{t.title}</span>
                      {isOverdue(t) && <AlertCircle size={14} className="mt-0.5 shrink-0 text-error" />}
                    </div>
                    {t.projectName && <span className="text-xs text-text-tertiary">{t.projectName}</span>}
                    <div className="flex items-center gap-1.5">
                      <Badge tone={PRIORITY_TONE[t.priority] ?? "neutral"}>{TASK_PRIORITY_LABELS[t.priority as keyof typeof TASK_PRIORITY_LABELS] ?? t.priority}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-tertiary">
                      <span>{t.assigneeName ?? "Sem responsável"}</span>
                      <span className={cn(isOverdue(t) && "text-error")}>{t.dueDate ? formatDate(new Date(t.dueDate)) : ""}</span>
                    </div>
                    {permissions.canEdit && (
                      <select
                        value={t.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          startTransition(() => updateTaskStatusAction(t.id, e.target.value));
                        }}
                        className="mt-1 h-8 rounded-[8px] border border-border bg-card-elevated px-2 text-xs text-text-secondary"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            Mover para: {TASK_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nova Tarefa">
        <TaskForm action={createTaskAction} projects={projects} users={users} submitLabel="Criar tarefa" onSuccess={() => setCreating(false)} />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing?.title ?? ""}>
        {editing && (
          <div className="flex flex-col gap-4">
            <TaskForm
              key={editing.id}
              action={updateTaskAction.bind(null, editing.id)}
              defaultValues={toFormValues(editing)}
              projects={projects}
              users={users}
              submitLabel="Salvar alterações"
            />
            {permissions.canDelete && (
              <Button
                variant="danger"
                onClick={() =>
                  startTransition(async () => {
                    await deleteTaskAction(editing.id);
                    setEditingId(null);
                  })
                }
              >
                <Trash2 size={14} /> Excluir tarefa
              </Button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
