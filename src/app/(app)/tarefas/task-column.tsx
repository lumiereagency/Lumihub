"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { TASK_STATUSES } from "@/lib/validation/tasks";
import { Popover } from "@/components/ui/popover";
import { SortableTaskCard } from "./task-card";
import { STATUS_META, type BoardLabel, type BoardList, type BoardTask, type Person, type TaskPermissions } from "./task-ui";

export function TaskColumn({
  list,
  lists,
  tasks,
  labels,
  people,
  now,
  permissions,
  isDropTarget,
  isFirst,
  isLast,
  filtered,
  onOpenTask,
  onQuickAdd,
  onRename,
  onChangeStatus,
  onMove,
  onDelete,
}: {
  list: BoardList;
  lists: BoardList[];
  tasks: BoardTask[];
  labels: Map<string, BoardLabel>;
  people: Map<string, Person>;
  now: number;
  permissions: TaskPermissions;
  isDropTarget: boolean;
  isFirst: boolean;
  isLast: boolean;
  filtered: boolean;
  onOpenTask: (id: string) => void;
  onQuickAdd: (listId: string, title: string) => void;
  onRename: (listId: string, name: string) => void;
  onChangeStatus: (listId: string, status: string) => void;
  onMove: (listId: string, direction: -1 | 1) => void;
  onDelete: (listId: string, moveTo: string | null) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `list:${list.id}`, data: { type: "list", listId: list.id } });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const [moveTo, setMoveTo] = useState("");
  const meta = STATUS_META[list.status];
  const otherLists = lists.filter((l) => l.id !== list.id);

  function submitDraft() {
    const title = draft.trim();
    if (!title) return;
    onQuickAdd(list.id, title);
    setDraft("");
  }

  function submitRename() {
    setRenaming(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== list.name) onRename(list.id, trimmed);
    else setName(list.name);
  }

  return (
    <section
      className={cn(
        "flex max-h-[calc(100vh-15rem)] min-h-[160px] w-[86vw] shrink-0 snap-start flex-col rounded-3xl border bg-card-elevated/70 transition-colors sm:w-[300px]",
        isDropTarget ? "border-accent/60 bg-accent/5" : "border-transparent",
      )}
      aria-label={`Lista ${list.name}`}
    >
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-3.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} title={`Conta como: ${meta.label}`} />
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setName(list.name);
                setRenaming(false);
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm font-semibold text-text-primary focus:outline-none focus:ring-4 focus:ring-accent/15"
            aria-label="Nome da lista"
          />
        ) : (
          <button
            type="button"
            disabled={!permissions.canEdit}
            onClick={() => setRenaming(true)}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-text-primary disabled:cursor-default"
          >
            {list.name}
          </button>
        )}
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-text-secondary">{tasks.length}</span>
        {permissions.canCreate && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-card hover:text-text-primary"
            aria-label={`Adicionar cartão em ${list.name}`}
          >
            <Plus size={16} />
          </button>
        )}
        {permissions.canEdit && (
          <Popover
            align="right"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-card hover:text-text-primary"
                aria-label={`Opções da lista ${list.name}`}
              >
                <MoreHorizontal size={16} />
              </button>
            )}
          >
            {(close) => (
              <div className="flex w-64 flex-col gap-1 text-sm">
                <button type="button" onClick={() => { close(); setRenaming(true); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-text-secondary hover:bg-card-elevated hover:text-text-primary">
                  <Pencil size={14} /> Renomear
                </button>
                <div className="flex gap-1">
                  <button type="button" disabled={isFirst} onClick={() => { close(); onMove(list.id, -1); }} className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-text-secondary hover:bg-card-elevated hover:text-text-primary disabled:opacity-40">
                    <ArrowLeft size={14} /> Mover
                  </button>
                  <button type="button" disabled={isLast} onClick={() => { close(); onMove(list.id, 1); }} className="flex flex-1 items-center justify-end gap-2 rounded-xl px-3 py-2 text-text-secondary hover:bg-card-elevated hover:text-text-primary disabled:opacity-40">
                    Mover <ArrowRight size={14} />
                  </button>
                </div>
                <div className="mt-1 border-t border-border px-3 pb-1 pt-3">
                  <p className="mb-2 text-xs font-medium text-text-tertiary">Cartões aqui contam como</p>
                  <div className="flex flex-col gap-1">
                    {TASK_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { close(); onChangeStatus(list.id, s); }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left",
                          list.status === s ? "bg-card-elevated font-medium text-text-primary" : "text-text-secondary hover:bg-card-elevated",
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)} />
                        {STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>
                {permissions.canDelete && (
                  <div className="mt-1 border-t border-border px-3 pb-2 pt-3">
                    {tasks.length > 0 || filtered ? (
                      <>
                        <p className="mb-2 text-xs text-text-tertiary">Para excluir, escolha para onde vão os cartões desta lista:</p>
                        <select
                          value={moveTo}
                          onChange={(e) => setMoveTo(e.target.value)}
                          className="mb-2 h-9 w-full rounded-xl border border-border bg-card px-2 text-sm text-text-primary"
                          aria-label="Mover cartões para"
                        >
                          <option value="">Mover cartões para…</option>
                          {otherLists.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!moveTo}
                          onClick={() => { close(); onDelete(list.id, moveTo); }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-error/10 px-3 py-2 font-medium text-error hover:bg-error/15 disabled:opacity-40"
                        >
                          <Trash2 size={14} /> Excluir lista
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { close(); onDelete(list.id, null); }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-error/10 px-3 py-2 font-medium text-error hover:bg-error/15"
                      >
                        <Trash2 size={14} /> Excluir lista
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Popover>
        )}
      </header>

      <div ref={setNodeRef} className="scrollbar-thin flex min-h-[40px] flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-2.5">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              labels={labels}
              people={people}
              now={now}
              disabled={!permissions.canEdit}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && !adding && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
            {filtered ? "Nenhum cartão com esses filtros" : "Arraste cartões para cá"}
          </div>
        )}
        {adding && (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitDraft();
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder="O que precisa ser feito? (Enter para salvar)"
              className="w-full resize-none rounded-2xl border border-border bg-card p-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
              aria-label="Título do novo cartão"
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={submitDraft} className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90">
                Adicionar cartão
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setDraft("");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-text-tertiary hover:bg-card hover:text-text-primary"
                aria-label="Cancelar"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {permissions.canCreate && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mx-2.5 mb-2.5 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-text-tertiary hover:bg-card hover:text-text-primary"
        >
          <Plus size={16} /> Adicionar cartão
        </button>
      )}
    </section>
  );
}
