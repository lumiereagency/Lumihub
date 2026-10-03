"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  Columns3,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { TASK_COLORS, TASK_COLOR_LABELS, colorClasses } from "@/lib/tasks/colors";
import {
  archiveBoardAction,
  archiveTaskAction,
  createBoardAction,
  createListAction,
  deleteListAction,
  deleteTaskPermanentlyAction,
  duplicateTaskAction,
  moveListAction,
  moveTaskAction,
  quickCreateTaskAction,
  setTaskDoneAction,
  toggleTaskLabelAction,
  toggleTaskMemberAction,
  updateBoardAction,
  updateListAction,
  updateTaskFieldsAction,
} from "@/lib/actions/task-board-actions";
import { Avatar } from "@/components/ui/avatar";
import { Drawer } from "@/components/ui/drawer";
import { Popover } from "@/components/ui/popover";
import { TaskCardView } from "./task-card";
import { TaskColumn } from "./task-column";
import { TaskModal, type ModalCallbacks } from "./task-modal";
import {
  DUE_CHIP,
  PRIORITY_META,
  STATUS_META,
  dueState,
  positionBetween,
  shortDate,
  type BoardLabel,
  type BoardList,
  type BoardSummary,
  type BoardTask,
  type Person,
  type TaskPermissions,
} from "./task-ui";

type Result = { ok: true } | { ok: false; error: string };

type OptimisticAction =
  | { type: "move"; id: string; listId: string; position: number; status: BoardTask["status"] }
  | { type: "add"; task: BoardTask }
  | { type: "patch"; id: string; patch: Partial<BoardTask> }
  | { type: "remove"; id: string };

function reducer(state: BoardTask[], action: OptimisticAction): BoardTask[] {
  switch (action.type) {
    case "move":
      return state.map((t) =>
        t.id === action.id
          ? { ...t, listId: action.listId, position: action.position, status: action.status, completedAt: action.status === "CONCLUIDA" ? (t.completedAt ?? new Date().toISOString()) : null }
          : t,
      );
    case "add":
      return [...state, action.task];
    case "patch":
      return state.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t));
    case "remove":
      return state.filter((t) => t.id !== action.id);
  }
}

const VIEW_KEY = "lb-tasks-view";
const VIEW_EVENT = "lb-tasks-view-change";
function subscribeView(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(VIEW_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(VIEW_EVENT, cb);
  };
}
function readView(): "quadro" | "lista" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "lista" ? "lista" : "quadro";
  } catch {
    return "quadro";
  }
}

type DueFilter = "todos" | "atrasadas" | "hoje" | "semana" | "sem-prazo";

export function TaskWorkspace({
  board,
  boards,
  lists,
  tasks,
  labels,
  users,
  projects,
  clients,
  archived,
  permissions,
  currentUserId,
  initialTaskId,
  now,
}: {
  board: { id: string; name: string; color: string; description: string | null };
  boards: BoardSummary[];
  lists: BoardList[];
  tasks: BoardTask[];
  labels: BoardLabel[];
  users: Person[];
  projects: { id: string; name: string }[];
  clients: { id: string; companyName: string }[];
  archived: { id: string; title: string; listName: string | null; archivedAt: string }[];
  permissions: TaskPermissions;
  currentUserId: string;
  initialTaskId: string | null;
  now: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimisticTasks, applyOptimistic] = useOptimistic(tasks, reducer);
  const view = useSyncExternalStore(subscribeView, readView, () => "quadro" as const);

  const [openTaskId, setOpenTaskId] = useState<string | null>(initialTaskId);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [dueFilter, setDueFilter] = useState<DueFilter>("todos");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overListId, setOverListId] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newBoard, setNewBoard] = useState({ name: "", color: "violet" });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [renamingBoard, setRenamingBoard] = useState(false);
  const [boardName, setBoardName] = useState(board.name);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const labelMap = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const peopleMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const listMap = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  const mutate = useCallback(
    (optimistic: OptimisticAction | null, call: () => Promise<Result | { ok: true; [k: string]: unknown }>, after?: (r: Result) => void) => {
      startTransition(async () => {
        if (optimistic) applyOptimistic(optimistic);
        const result = (await call()) as Result;
        if (!result.ok) setToast(result.error);
        after?.(result);
      });
    },
    [applyOptimistic],
  );

  const openTask = useCallback(
    (id: string | null) => {
      setOpenTaskId(id);
      const params = new URLSearchParams(window.location.search);
      params.set("quadro", board.id);
      if (id) params.set("cartao", id);
      else params.delete("cartao");
      window.history.replaceState(null, "", `?${params.toString()}`);
    },
    [board.id],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return optimisticTasks.filter((t) => {
      if (memberFilter === "me" && t.assignee?.id !== currentUserId && !t.memberIds.includes(currentUserId)) return false;
      if (memberFilter && memberFilter !== "me" && t.assignee?.id !== memberFilter && !t.memberIds.includes(memberFilter)) return false;
      if (labelFilter && !t.labelIds.includes(labelFilter)) return false;
      if (dueFilter !== "todos") {
        const state = dueState(t, now);
        if (dueFilter === "sem-prazo" && t.dueDate) return false;
        if (dueFilter === "atrasadas" && state !== "overdue") return false;
        if (dueFilter === "hoje" && state !== "today") return false;
        if (dueFilter === "semana") {
          if (!t.dueDate || state === "done") return false;
          const days = (new Date(t.dueDate).getTime() - now) / 86400000;
          if (days > 7) return false;
        }
      }
      if (!q) return true;
      return [t.title, t.description, t.client?.companyName, t.project?.name, t.assignee?.name]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [optimisticTasks, search, memberFilter, labelFilter, dueFilter, currentUserId, now]);

  const isFiltering = !!search.trim() || !!memberFilter || !!labelFilter || dueFilter !== "todos";

  const tasksByList = useMemo(() => {
    const map = new Map<string, BoardTask[]>();
    for (const l of lists) map.set(l.id, []);
    for (const t of filtered) map.get(t.listId)?.push(t);
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [filtered, lists]);

  const stats = useMemo(() => {
    const total = optimisticTasks.length;
    const doneCount = optimisticTasks.filter((t) => t.status === "CONCLUIDA").length;
    const doing = optimisticTasks.filter((t) => t.status === "EM_ANDAMENTO" || t.status === "EM_REVISAO").length;
    const overdue = optimisticTasks.filter((t) => dueState(t, now) === "overdue").length;
    const mine = optimisticTasks.filter((t) => t.status !== "CONCLUIDA" && (t.assignee?.id === currentUserId || t.memberIds.includes(currentUserId))).length;
    return { total, doneCount, doing, overdue, mine };
  }, [optimisticTasks, now, currentUserId]);

  const boardPeople = useMemo(() => {
    const ids = new Set<string>();
    for (const t of optimisticTasks) {
      if (t.assignee) ids.add(t.assignee.id);
      t.memberIds.forEach((id) => ids.add(id));
    }
    return users.filter((u) => ids.has(u.id));
  }, [optimisticTasks, users]);

  // ------------------------------------------------------------ Drag and drop

  function listIdOf(id: string | number | undefined | null): string | null {
    if (id == null) return null;
    const key = String(id);
    if (key.startsWith("list:")) return key.slice(5);
    return optimisticTasks.find((t) => t.id === key)?.listId ?? null;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    setOverListId(listIdOf(e.over?.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setOverListId(null);
    const active = optimisticTasks.find((t) => t.id === String(e.active.id));
    if (!active || !e.over) return;
    const targetListId = listIdOf(e.over.id);
    const targetList = targetListId ? listMap.get(targetListId) : null;
    if (!targetList) return;

    const column = optimisticTasks.filter((t) => t.listId === targetList.id && t.id !== active.id).sort((a, b) => a.position - b.position);
    let index = column.length;
    const overKey = String(e.over.id);
    if (!overKey.startsWith("list:")) {
      const overIndex = column.findIndex((t) => t.id === overKey);
      if (overIndex >= 0) {
        const fullColumn = optimisticTasks.filter((t) => t.listId === targetList.id).sort((a, b) => a.position - b.position);
        const movingDown = active.listId === targetList.id && fullColumn.findIndex((t) => t.id === active.id) < fullColumn.findIndex((t) => t.id === overKey);
        index = movingDown ? overIndex + 1 : overIndex;
      }
    }
    const position = positionBetween(column[index - 1]?.position, column[index]?.position);
    if (active.listId === targetList.id && Math.abs(position - active.position) < 1e-9) return;

    mutate({ type: "move", id: active.id, listId: targetList.id, position, status: targetList.status }, () =>
      moveTaskAction(active.id, targetList.id, position),
    );
  }

  // ------------------------------------------------------------ Mutações

  function quickAdd(listId: string, title: string) {
    const list = listMap.get(listId);
    if (!list) return;
    const last = optimisticTasks.filter((t) => t.listId === listId).sort((a, b) => b.position - a.position)[0];
    const temp: BoardTask = {
      id: `temp-${title}-${Math.random().toString(36).slice(2)}`,
      title,
      description: null,
      listId,
      position: (last?.position ?? 0) + 1024,
      status: list.status,
      priority: "MEDIA",
      coverColor: null,
      startDate: null,
      dueDate: null,
      completedAt: null,
      assignee: null,
      memberIds: [],
      labelIds: [],
      project: null,
      client: null,
      checklistDone: 0,
      checklistTotal: 0,
      commentCount: 0,
      attachmentCount: 0,
      pending: true,
    };
    mutate({ type: "add", task: temp }, () => quickCreateTaskAction(listId, title));
  }

  const callbacks: ModalCallbacks = {
    patch: (id, patch, server) => mutate({ type: "patch", id, patch }, () => updateTaskFieldsAction(id, server)),
    move: (id, listId, otherBoardId) => {
      const list = listMap.get(listId);
      if (otherBoardId) {
        mutate({ type: "remove", id }, () => moveTaskAction(id, listId, -1), (r) => r.ok && openTask(null));
        return;
      }
      if (!list) return;
      const last = optimisticTasks.filter((t) => t.listId === listId && t.id !== id).sort((a, b) => b.position - a.position)[0];
      const position = (last?.position ?? 0) + 1024;
      mutate({ type: "move", id, listId, position, status: list.status }, () => moveTaskAction(id, listId, position));
    },
    setDone: (id, isDone) => {
      const target = isDone ? lists.find((l) => l.status === "CONCLUIDA") : lists.find((l) => l.status !== "CONCLUIDA");
      const optimistic: OptimisticAction | null = target
        ? { type: "move", id, listId: target.id, position: Number.MAX_SAFE_INTEGER / 2, status: target.status }
        : { type: "patch", id, patch: { status: isDone ? "CONCLUIDA" : "A_FAZER" } };
      mutate(optimistic, () => setTaskDoneAction(id, isDone));
    },
    toggleLabel: (id, labelId) => {
      const t = optimisticTasks.find((x) => x.id === id);
      if (!t) return;
      const labelIds = t.labelIds.includes(labelId) ? t.labelIds.filter((l) => l !== labelId) : [...t.labelIds, labelId];
      mutate({ type: "patch", id, patch: { labelIds } }, () => toggleTaskLabelAction(id, labelId));
    },
    toggleMember: (id, userId) => {
      const t = optimisticTasks.find((x) => x.id === id);
      if (!t) return;
      const memberIds = t.memberIds.includes(userId) ? t.memberIds.filter((m) => m !== userId) : [...t.memberIds, userId];
      mutate({ type: "patch", id, patch: { memberIds } }, () => toggleTaskMemberAction(id, userId));
    },
    duplicate: (id) => mutate(null, () => duplicateTaskAction(id), (r) => r.ok && setToast("Cartão duplicado.")),
    archive: (id) => {
      openTask(null);
      mutate({ type: "remove", id }, () => archiveTaskAction(id, true), (r) => r.ok && setToast("Cartão arquivado — dá para restaurar em Arquivados."));
    },
    remove: (id) => {
      openTask(null);
      mutate({ type: "remove", id }, () => deleteTaskPermanentlyAction(id));
    },
    notify: setToast,
  };

  const openTaskData = openTaskId ? optimisticTasks.find((t) => t.id === openTaskId) : null;
  const activeTask = activeId ? optimisticTasks.find((t) => t.id === activeId) : null;
  const boardColor = colorClasses(board.color);

  const counters = [
    { label: "Cartões", value: stats.total, icon: LayoutGrid, tone: "bg-card", onClick: () => setDueFilter("todos") },
    { label: "Em andamento", value: stats.doing, icon: Clock, tone: "bg-info/10", onClick: undefined },
    { label: "Atrasados", value: stats.overdue, icon: AlertTriangle, tone: stats.overdue ? "bg-error/10" : "bg-card", onClick: () => setDueFilter("atrasadas") },
    { label: "Concluídos", value: stats.doneCount, icon: CheckCircle2, tone: "bg-success/10", onClick: undefined },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Quadros */}
      <div className="scrollbar-thin -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        {boards.map((b) => {
          const active = b.id === board.id;
          return (
            <Link
              key={b.id}
              href={`/tarefas?quadro=${b.id}`}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                active ? "border-transparent bg-ink text-ink-on" : "border-border bg-card text-text-secondary hover:text-text-primary",
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", colorClasses(b.color)?.dot ?? "bg-accent")} />
              {b.name}
              <span className={cn("text-xs", active ? "opacity-70" : "text-text-tertiary")}>{b.openCount}</span>
            </Link>
          );
        })}
        {permissions.canCreate && (
          <Popover
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-4 text-sm font-medium text-text-tertiary hover:text-text-primary"
              >
                <Plus size={15} /> Novo quadro
              </button>
            )}
          >
            {(close) => (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newBoard.name.trim();
                  if (!name) return;
                  startTransition(async () => {
                    const r = await createBoardAction(name, newBoard.color);
                    if (!r.ok) return setToast(r.error);
                    close();
                    setNewBoard({ name: "", color: newBoard.color });
                    router.push(`/tarefas?quadro=${r.boardId}`);
                  });
                }}
                className="flex w-72 flex-col gap-3 p-2"
              >
                <p className="text-sm font-semibold text-text-primary">Novo quadro</p>
                <input
                  autoFocus
                  value={newBoard.name}
                  onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })}
                  placeholder="Ex: Social Media, Produção, Clientes VIP"
                  className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-4 focus:ring-accent/15"
                  aria-label="Nome do quadro"
                />
                <div className="flex flex-wrap gap-1.5">
                  {TASK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewBoard({ ...newBoard, color: c })}
                      className={cn("h-7 w-7 rounded-full", colorClasses(c)?.dot, newBoard.color === c && "ring-2 ring-text-primary ring-offset-2 ring-offset-card")}
                      aria-label={TASK_COLOR_LABELS[c]}
                    />
                  ))}
                </div>
                <p className="text-xs text-text-tertiary">Já começa com as listas A fazer, Em andamento, Em revisão e Concluído.</p>
                <button type="submit" className="h-10 rounded-full bg-ink text-sm font-medium text-ink-on hover:opacity-90">
                  Criar quadro
                </button>
              </form>
            )}
          </Popover>
        )}
      </div>

      {/* Cabeçalho do quadro + contadores */}
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", boardColor?.soft ?? "bg-accent/15")}>
              <Columns3 size={20} className="text-text-primary" />
            </span>
            <div className="min-w-0">
              {renamingBoard ? (
                <input
                  autoFocus
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  onBlur={() => {
                    setRenamingBoard(false);
                    const name = boardName.trim();
                    if (name && name !== board.name) mutate(null, () => updateBoardAction(board.id, { name }));
                    else setBoardName(board.name);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="h-9 rounded-xl border border-border bg-card px-2 text-xl font-semibold tracking-tight text-text-primary focus:outline-none"
                  aria-label="Nome do quadro"
                />
              ) : (
                <h2 className="truncate text-xl font-semibold tracking-tight text-text-primary">{board.name}</h2>
              )}
              <p className="text-sm text-text-tertiary">
                {stats.mine > 0 ? `Você tem ${stats.mine} cartão${stats.mine === 1 ? "" : "es"} em aberto aqui` : "Nenhum cartão em aberto com você neste quadro"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {boardPeople.length > 0 && (
              <div className="hidden -space-x-2 sm:flex">
                {boardPeople.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMemberFilter(memberFilter === p.id ? null : p.id)}
                    className={cn("rounded-full ring-2 ring-card transition-transform hover:z-10 hover:-translate-y-0.5", memberFilter === p.id && "z-10 ring-accent")}
                    title={`Filtrar por ${p.name}`}
                  >
                    <Avatar name={p.name} src={p.avatarUrl} size="md" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex rounded-full border border-border bg-card-elevated p-1" role="group" aria-label="Modo de visualização">
              {(
                [
                  ["quadro", "Quadro", Columns3],
                  ["lista", "Lista", ListIcon],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => {
                    try {
                      window.localStorage.setItem(VIEW_KEY, key);
                    } catch {}
                    window.dispatchEvent(new Event(VIEW_EVENT));
                  }}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
                    view === key ? "bg-card text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <Popover
              align="right"
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-card-elevated" aria-label="Opções do quadro">
                  <MoreHorizontal size={18} />
                </button>
              )}
            >
              {(close) => (
                <div className="flex w-64 flex-col gap-1 text-sm">
                  {permissions.canEdit && (
                    <button type="button" onClick={() => { close(); setRenamingBoard(true); }} className="rounded-xl px-3 py-2 text-left text-text-secondary hover:bg-card-elevated hover:text-text-primary">
                      Renomear quadro
                    </button>
                  )}
                  {permissions.canEdit && (
                    <div className="px-3 py-2">
                      <p className="mb-2 text-xs font-medium text-text-tertiary">Cor do quadro</p>
                      <div className="flex flex-wrap gap-1.5">
                        {TASK_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { close(); mutate(null, () => updateBoardAction(board.id, { color: c })); }}
                            className={cn("h-6 w-6 rounded-full", colorClasses(c)?.dot, board.color === c && "ring-2 ring-text-primary ring-offset-2 ring-offset-card")}
                            aria-label={TASK_COLOR_LABELS[c]}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={() => { close(); setArchiveOpen(true); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-text-secondary hover:bg-card-elevated hover:text-text-primary">
                    <Archive size={14} /> Cartões arquivados ({archived.length})
                  </button>
                  {permissions.canDelete && boards.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        if (!confirm(`Arquivar o quadro "${board.name}"? Ele some da lista de quadros.`)) return;
                        startTransition(async () => {
                          const r = await archiveBoardAction(board.id);
                          if (!r.ok) return setToast(r.error);
                          router.push("/tarefas");
                        });
                      }}
                      className="rounded-xl px-3 py-2 text-left text-error hover:bg-error/10"
                    >
                      Arquivar quadro
                    </button>
                  )}
                </div>
              )}
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {counters.map((c) => {
            const Icon = c.icon;
            const Comp = c.onClick ? "button" : "div";
            return (
              <Comp
                key={c.label}
                type={c.onClick ? "button" : undefined}
                onClick={c.onClick}
                className={cn("flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left", c.tone, c.onClick && "transition-colors hover:border-text-tertiary/60")}
              >
                <Icon size={18} className="shrink-0 text-text-tertiary" />
                <div>
                  <p className="text-[22px] font-semibold leading-none tracking-tight text-text-primary">{c.value}</p>
                  <p className="mt-1 text-xs text-text-tertiary">{c.label}</p>
                </div>
              </Comp>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:min-w-[200px] sm:flex-1">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-text-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cartões, clientes, projetos…"
              aria-label="Buscar cartões"
              className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
            />
          </div>
          <button
            type="button"
            aria-pressed={memberFilter === "me"}
            onClick={() => setMemberFilter(memberFilter === "me" ? null : "me")}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium",
              memberFilter === "me" ? "border-transparent bg-ink text-ink-on" : "border-border bg-card text-text-secondary hover:text-text-primary",
            )}
          >
            <User size={14} /> Minhas<span className="hidden sm:inline">&nbsp;tarefas</span>
          </button>
          <select
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value as DueFilter)}
            aria-label="Filtrar por prazo"
            className="h-10 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm text-text-primary focus:outline-none sm:flex-none"
          >
            <option value="todos">Prazo</option>
            <option value="atrasadas">Atrasados</option>
            <option value="hoje">Vencem hoje</option>
            <option value="semana">Próximos 7 dias</option>
            <option value="sem-prazo">Sem prazo</option>
          </select>
          <select
            value={labelFilter ?? ""}
            onChange={(e) => setLabelFilter(e.target.value || null)}
            aria-label="Filtrar por etiqueta"
            className="h-10 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm text-text-primary focus:outline-none sm:flex-none"
          >
            <option value="">Etiquetas</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name || "Sem nome"}
              </option>
            ))}
          </select>
          {memberFilter && memberFilter !== "me" && (
            <button type="button" onClick={() => setMemberFilter(null)} className="flex h-10 items-center gap-1.5 rounded-full bg-accent/12 px-4 text-sm font-medium text-accent-light">
              {peopleMap.get(memberFilter)?.name} <X size={14} />
            </button>
          )}
          {isFiltering && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setMemberFilter(null);
                setLabelFilter(null);
                setDueFilter("todos");
              }}
              className="h-10 rounded-full px-3 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Quadro */}
      {view === "quadro" ? (
        <DndContext
          id="task-board-dnd"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOverListId(null);
          }}
        >
          <div className="scrollbar-thin -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:snap-none sm:px-0">
            {lists.map((list, i) => (
              <TaskColumn
                key={list.id}
                list={list}
                lists={lists}
                tasks={tasksByList.get(list.id) ?? []}
                labels={labelMap}
                people={peopleMap}
                now={now}
                permissions={permissions}
                isDropTarget={!!activeId && overListId === list.id && activeTask?.listId !== list.id}
                isFirst={i === 0}
                isLast={i === lists.length - 1}
                filtered={isFiltering}
                onOpenTask={openTask}
                onQuickAdd={quickAdd}
                onRename={(id, name) => mutate(null, () => updateListAction(id, { name }))}
                onChangeStatus={(id, status) => mutate(null, () => updateListAction(id, { status }))}
                onMove={(id, dir) => mutate(null, () => moveListAction(id, dir))}
                onDelete={(id, moveTo) => mutate(null, () => deleteListAction(id, moveTo))}
              />
            ))}

            {permissions.canCreate && (
              <div className="w-[86vw] shrink-0 snap-start sm:w-[300px]">
                {addingList ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = newListName.trim();
                      if (!name) return;
                      setNewListName("");
                      mutate(null, () => createListAction(board.id, name));
                    }}
                    className="flex flex-col gap-2 rounded-3xl border border-border bg-card p-3"
                  >
                    <input
                      autoFocus
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setAddingList(false)}
                      placeholder="Nome da lista"
                      className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-4 focus:ring-accent/15"
                      aria-label="Nome da nova lista"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90">
                        Adicionar lista
                      </button>
                      <button type="button" onClick={() => setAddingList(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-text-tertiary hover:bg-card-elevated" aria-label="Cancelar">
                        <X size={16} />
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingList(true)}
                    className="flex h-14 w-full items-center gap-2 rounded-3xl border border-dashed border-border px-4 text-sm font-medium text-text-tertiary hover:bg-card hover:text-text-primary"
                  >
                    <Plus size={16} /> Adicionar outra lista
                  </button>
                )}
              </div>
            )}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
            {activeTask ? (
              <div className="w-[272px]">
                <TaskCardView task={activeTask} labels={labelMap} people={peopleMap} now={now} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <TaskListView tasks={filtered} lists={lists} labels={labelMap} now={now} permissions={permissions} onOpen={openTask} onMove={callbacks.move} />
      )}

      {openTaskData && (
        <TaskModal
          key={openTaskData.id}
          task={openTaskData}
          boardId={board.id}
          lists={lists}
          boards={boards}
          labels={labels}
          users={users}
          projects={projects}
          clients={clients}
          permissions={permissions}
          currentUserId={currentUserId}
          now={now}
          callbacks={callbacks}
          onClose={() => openTask(null)}
        />
      )}

      <Drawer open={archiveOpen} onClose={() => setArchiveOpen(false)} title="Cartões arquivados" description="Cartões arquivados não aparecem no quadro, mas podem voltar quando quiser.">
        {archived.length === 0 ? (
          <p className="text-sm text-text-tertiary">Nenhum cartão arquivado neste quadro.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {archived.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{a.title}</p>
                  <p className="text-xs text-text-tertiary">
                    {a.listName ?? "Sem lista"} · arquivado em {shortDate(a.archivedAt)}
                  </p>
                </div>
                {permissions.canEdit && (
                  <button
                    type="button"
                    onClick={() => mutate(null, () => archiveTaskAction(a.id, false), (r) => r.ok && setToast("Cartão restaurado."))}
                    className="h-9 shrink-0 rounded-full bg-card-elevated px-3 text-sm font-medium text-text-primary hover:bg-border/60"
                  >
                    Restaurar
                  </button>
                )}
                {permissions.canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Excluir "${a.title}" de vez?`)) mutate(null, () => deleteTaskPermanentlyAction(a.id));
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-tertiary hover:bg-error/10 hover:text-error"
                    aria-label={`Excluir ${a.title}`}
                  >
                    <X size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Drawer>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-medium text-ink-on shadow-2xl">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Fechar aviso" className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function TaskListView({
  tasks,
  lists,
  labels,
  now,
  permissions,
  onOpen,
  onMove,
}: {
  tasks: BoardTask[];
  lists: BoardList[];
  labels: Map<string, BoardLabel>;
  now: number;
  permissions: TaskPermissions;
  onOpen: (id: string) => void;
  onMove: (id: string, listId: string) => void;
}) {
  const order = new Map(lists.map((l, i) => [l.id, i]));
  const sorted = [...tasks].sort((a, b) => (order.get(a.listId) ?? 0) - (order.get(b.listId) ?? 0) || a.position - b.position);

  if (sorted.length === 0) {
    return <div className="rounded-3xl border border-border bg-card py-14 text-center text-sm text-text-tertiary">Nenhum cartão por aqui.</div>;
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-col gap-2 md:hidden">
        {sorted.map((t) => {
          const due = dueState(t, now);
          return (
            <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="flex flex-col gap-2 rounded-2xl border border-border p-3.5 text-left">
              <p className="font-medium text-text-primary">{t.title}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[t.status].dot)} />
                  {lists.find((l) => l.id === t.listId)?.name}
                </span>
                {due && t.dueDate && <span className={cn("rounded-full px-2 py-0.5 font-medium", DUE_CHIP[due])}>{shortDate(t.dueDate)}</span>}
                {t.assignee && <span>{t.assignee.name}</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="whitespace-nowrap bg-bg-secondary text-left text-xs text-text-tertiary">
              <th className="px-4 py-3 font-medium">Cartão</th>
              <th className="px-4 py-3 font-medium">Lista</th>
              <th className="px-4 py-3 font-medium">Responsável</th>
              <th className="px-4 py-3 font-medium">Prazo</th>
              <th className="px-4 py-3 font-medium">Prioridade</th>
              <th className="px-4 py-3 font-medium">Checklist</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const due = dueState(t, now);
              const taskLabels = t.labelIds.map((id) => labels.get(id)).filter((l): l is BoardLabel => !!l);
              return (
                <tr key={t.id} onClick={() => onOpen(t.id)} className="cursor-pointer border-t border-border transition-colors hover:bg-card-elevated">
                  <td className="max-w-[340px] px-4 py-3">
                    <p className={cn("truncate font-medium text-text-primary", t.status === "CONCLUIDA" && "text-text-tertiary line-through")}>{t.title}</p>
                    {(taskLabels.length > 0 || t.client) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {taskLabels.map((l) => (
                          <span key={l.id} className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
                            <span className={cn("h-1.5 w-1.5 rounded-full", colorClasses(l.color)?.dot)} />
                            {l.name}
                          </span>
                        ))}
                        {t.client && <span className="text-[11px] text-text-tertiary">· {t.client.companyName}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {permissions.canEdit ? (
                      <select
                        value={t.listId}
                        onChange={(e) => onMove(t.id, e.target.value)}
                        className="h-8 rounded-full border border-border bg-card-elevated px-3 text-xs font-medium text-text-primary focus:outline-none"
                        aria-label={`Lista de ${t.title}`}
                      >
                        {lists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      lists.find((l) => l.id === t.listId)?.name
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-secondary">{t.assignee?.name ?? <span className="text-text-tertiary">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {due && t.dueDate ? <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", DUE_CHIP[due])}>{shortDate(t.dueDate)}</span> : <span className="text-text-tertiary">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 text-sm", PRIORITY_META[t.priority].className)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_META[t.priority].dot)} />
                      {PRIORITY_META[t.priority].label}
                    </span>
                  </td>
                  <td className="lb-figures whitespace-nowrap px-4 py-3 text-text-secondary">{t.checklistTotal ? `${t.checklistDone}/${t.checklistTotal}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
