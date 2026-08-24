"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, FolderKanban, LayoutGrid, List as ListIcon, AlertCircle } from "lucide-react";
import { createProjectAction, updateProjectStatusAction } from "@/lib/actions/project-actions";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/validation/projects";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectForm } from "./project-form";

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  value: number | null;
  costEstimate: number | null;
  client: { id: string; companyName: string };
  responsible: { id: string; name: string } | null;
  tasksCount: number;
  teamCount: number;
}

function isOverdue(p: ProjectRow): boolean {
  if (p.status === "CONCLUIDO") return false;
  if (!p.dueDate) return false;
  return new Date(p.dueDate).getTime() < Date.now();
}

export function ProjectBoard({
  projects,
  clients,
  users,
  currency,
  permissions,
}: {
  projects: ProjectRow[];
  clients: { id: string; companyName: string }[];
  users: { id: string; name: string }[];
  currency: string;
  permissions: { canCreate: boolean; canEdit: boolean };
}) {
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  const columns = useMemo(
    () => PROJECT_STATUSES.map((status) => ({ status, items: projects.filter((p) => p.status === status) })),
    [projects],
  );

  function handleStageChange(projectId: string, status: string) {
    startTransition(() => updateProjectStatusAction(projectId, status));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-[10px] border border-border bg-card p-1 w-fit">
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={cn("flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-sm", view === "kanban" ? "bg-card-elevated text-accent-light" : "text-text-secondary")}
          >
            <LayoutGrid size={14} /> Kanban
          </button>
          <button
            type="button"
            onClick={() => setView("lista")}
            className={cn("flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-sm", view === "lista" ? "bg-card-elevated text-accent-light" : "text-text-secondary")}
          >
            <ListIcon size={14} /> Lista
          </button>
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setCreating(true)} disabled={clients.length === 0}>
            <Plus size={16} /> Novo Projeto
          </Button>
        )}
      </div>

      {clients.length === 0 && <p className="text-sm text-text-tertiary">Cadastre um cliente antes de criar um projeto.</p>}

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={28} />}
          title="Nenhum projeto cadastrado ainda"
          description="Crie um projeto vinculado a um cliente para começar a organizar tarefas e entregas."
          action={
            permissions.canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Adicionar projeto
              </Button>
            )
          }
        />
      ) : view === "kanban" ? (
        <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
          {columns.map((col) => (
            <div key={col.status} className="flex w-72 shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-text-primary">{PROJECT_STATUS_LABELS[col.status]}</span>
                <span className="text-xs text-text-tertiary">{col.items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {col.items.map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
                    <Link href={`/projetos/${p.id}`} className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary hover:text-accent-light">{p.name}</span>
                      {isOverdue(p) && <AlertCircle size={14} className="mt-0.5 shrink-0 text-error" />}
                    </Link>
                    <span className="text-xs text-text-tertiary">{p.client.companyName}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.value != null && <Badge tone="accent">{formatCurrency(p.value, currency)}</Badge>}
                      <Badge tone="neutral">{p.tasksCount} tarefas</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-text-tertiary">
                      <span>{p.responsible?.name ?? "Sem responsável"}</span>
                      <span className={cn(isOverdue(p) && "text-error")}>{p.dueDate ? formatDate(new Date(p.dueDate)) : "Sem prazo"}</span>
                    </div>
                    {permissions.canEdit && (
                      <select
                        value={p.status}
                        onChange={(e) => handleStageChange(p.id, e.target.value)}
                        className="mt-1 h-8 rounded-[8px] border border-border bg-card-elevated px-2 text-xs text-text-secondary"
                      >
                        {PROJECT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            Mover para: {PROJECT_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-3 font-medium">Projeto</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Prazo</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-card">
                  <td className="px-4 py-3">
                    <Link href={`/projetos/${p.id}`} className="font-medium text-text-primary hover:text-accent-light">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{p.client.companyName}</td>
                  <td className="px-4 py-3 text-text-secondary">{p.responsible?.name ?? "—"}</td>
                  <td className={cn("px-4 py-3 text-text-secondary", isOverdue(p) && "text-error")}>
                    {p.dueDate ? formatDate(new Date(p.dueDate)) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">{PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS] ?? p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo Projeto">
        <ProjectForm action={createProjectAction} clients={clients} users={users} submitLabel="Criar projeto" onSuccess={() => setCreating(false)} />
      </Drawer>
    </div>
  );
}
