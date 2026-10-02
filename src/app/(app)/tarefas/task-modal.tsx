"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlignLeft,
  Archive,
  ArrowRightLeft,
  CheckSquare,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { TASK_COLORS, TASK_COLOR_LABELS, colorClasses } from "@/lib/tasks/colors";
import { TASK_PRIORITIES } from "@/lib/validation/tasks";
import {
  addChecklistItemAction,
  addTaskAttachmentAction,
  addTaskCommentAction,
  createLabelAction,
  deleteChecklistItemAction,
  deleteLabelAction,
  deleteTaskAttachmentAction,
  deleteTaskCommentAction,
  getTaskDetailsAction,
  toggleChecklistItemAction,
  updateChecklistItemAction,
  type TaskDetails,
} from "@/lib/actions/task-board-actions";
import { Avatar } from "@/components/ui/avatar";
import { Popover } from "@/components/ui/popover";
import {
  DUE_CHIP,
  DUE_LABEL,
  PRIORITY_META,
  STATUS_META,
  dateInputValue,
  dueState,
  relativeTime,
  type BoardLabel,
  type BoardList,
  type BoardSummary,
  type BoardTask,
  type Person,
  type TaskPermissions,
} from "./task-ui";

type Result = { ok: true } | { ok: false; error: string };

export interface ModalCallbacks {
  patch: (id: string, patch: Partial<BoardTask> & Record<string, unknown>, server: Record<string, unknown>) => void;
  move: (id: string, listId: string, boardId?: string) => void;
  setDone: (id: string, done: boolean) => void;
  toggleLabel: (id: string, labelId: string) => void;
  toggleMember: (id: string, userId: string) => void;
  duplicate: (id: string) => void;
  archive: (id: string) => void;
  remove: (id: string) => void;
  notify: (message: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  title: "o título",
  description: "a descrição",
  priority: "a prioridade",
  dueDate: "o prazo",
  startDate: "o início",
  coverColor: "a capa",
  assigneeUserId: "o responsável",
  projectId: "o projeto",
  clientId: "o cliente",
};

function describeActivity(action: string, meta: Record<string, unknown>): string {
  switch (action) {
    case "TASK_CREATED":
      return typeof meta.copiedFrom === "string" ? `copiou este cartão de "${meta.copiedFrom}"` : `criou este cartão${typeof meta.list === "string" ? ` em ${meta.list}` : ""}`;
    case "TASK_MOVED":
      return `moveu de ${meta.from ?? "—"} para ${meta.to ?? "—"}${typeof meta.board === "string" ? ` (quadro ${meta.board})` : ""}`;
    case "TASK_UPDATED": {
      const fields = Array.isArray(meta.fields) ? (meta.fields as string[]).map((f) => FIELD_LABELS[f]).filter(Boolean) : [];
      return fields.length ? `alterou ${fields.join(", ")}` : "atualizou o cartão";
    }
    case "TASK_CHECKLIST_DONE":
      return `concluiu "${meta.item}"`;
    case "TASK_ARCHIVED":
      return "arquivou o cartão";
    case "TASK_RESTORED":
      return "restaurou o cartão";
    default:
      return "atualizou o cartão";
  }
}

export function TaskModal({
  task,
  boardId,
  lists,
  boards,
  labels,
  users,
  projects,
  clients,
  permissions,
  currentUserId,
  now,
  callbacks,
  onClose,
}: {
  task: BoardTask;
  boardId: string;
  lists: BoardList[];
  boards: BoardSummary[];
  labels: BoardLabel[];
  users: Person[];
  projects: { id: string; name: string }[];
  clients: { id: string; companyName: string }[];
  permissions: TaskPermissions;
  currentUserId: string;
  now: number;
  callbacks: ModalCallbacks;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<TaskDetails | null>(null);
  const [title, setTitle] = useState(task.title);
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(task.description ?? "");
  const [newItem, setNewItem] = useState("");
  const [editingItem, setEditingItem] = useState<{ id: string; text: string } | null>(null);
  const [comment, setComment] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [newLabel, setNewLabel] = useState({ name: "", color: "orange" });
  const [showActivity, setShowActivity] = useState(true);
  const canEdit = permissions.canEdit;

  const reload = () => getTaskDetailsAction(task.id).then(setDetails);

  useEffect(() => {
    getTaskDetailsAction(task.id).then(setDetails);
  }, [task.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function run(call: () => Promise<Result>, after?: () => void) {
    const result = await call();
    if (!result.ok) callbacks.notify(result.error);
    else after?.();
    reload();
  }

  const list = lists.find((l) => l.id === task.listId);
  const due = dueState(task, now);
  const cover = colorClasses(task.coverColor);
  const taskLabels = labels.filter((l) => task.labelIds.includes(l.id));
  const members = users.filter((u) => task.memberIds.includes(u.id));
  const checklist = details?.checklist ?? [];
  const checklistDone = checklist.filter((c) => c.done).length;
  const progress = checklist.length ? Math.round((checklistDone / checklist.length) * 100) : 0;
  const isDone = task.status === "CONCLUIDA";

  const timeline = useMemo(() => {
    if (!details) return [];
    const items = [
      ...details.comments.map((c) => ({ kind: "comment" as const, id: c.id, at: c.createdAt, data: c })),
      ...(showActivity ? details.activity.map((a) => ({ kind: "activity" as const, id: a.id, at: a.createdAt, data: a })) : []),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [details, showActivity]);

  function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed) return setTitle(task.title);
    if (trimmed !== task.title) callbacks.patch(task.id, { title: trimmed }, { title: trimmed });
  }

  function saveDescription() {
    setEditingDescription(false);
    if ((task.description ?? "") !== description) callbacks.patch(task.id, { description: description || null }, { description: description || null });
  }

  const sectionTitle = "flex items-center gap-2 text-sm font-semibold text-text-primary";
  const sideButton =
    "flex w-full items-center gap-2 rounded-xl bg-card-elevated px-3 py-2 text-left text-sm font-medium text-text-secondary transition-colors hover:bg-border/60 hover:text-text-primary disabled:opacity-40";
  const fieldClass =
    "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-0 backdrop-blur-[2px] sm:p-6 sm:pt-[6vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={task.title} className="relative w-full max-w-[880px] overflow-hidden bg-card shadow-2xl sm:rounded-3xl sm:border sm:border-border">
        {cover && <div className={cn("h-20 w-full border-b", cover.tint)} />}

        <div className="flex items-start gap-3 px-5 pb-2 pt-5 sm:px-7">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => callbacks.setDone(task.id, !isDone)}
            className={cn(
              "mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              isDone ? "border-success bg-success text-white" : "border-text-tertiary hover:border-success",
            )}
            aria-label={isDone ? "Reabrir cartão" : "Marcar como concluído"}
            title={isDone ? "Reabrir" : "Marcar como concluído"}
          >
            {isDone && <CheckSquare size={13} />}
          </button>
          <div className="min-w-0 flex-1">
            <textarea
              value={title}
              rows={1}
              disabled={!canEdit}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              className="field-sizing-content w-full resize-none rounded-xl bg-transparent px-1 py-0.5 text-xl font-semibold tracking-tight text-text-primary focus:bg-card-elevated focus:outline-none sm:text-2xl"
              aria-label="Título do cartão"
            />
            <p className="mt-1 flex flex-wrap items-center gap-1.5 px-1 text-sm text-text-tertiary">
              na lista
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card-elevated px-2.5 py-0.5 font-medium text-text-secondary">
                <span className={cn("h-1.5 w-1.5 rounded-full", list ? STATUS_META[list.status].dot : "bg-text-tertiary")} />
                {list?.name ?? "—"}
              </span>
              {details?.createdByName && <span>· criado por {details.createdByName}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 px-5 pb-7 pt-4 sm:px-7 md:grid-cols-[1fr_210px]">
          <div className="flex min-w-0 flex-col gap-7">
            {(members.length > 0 || taskLabels.length > 0 || due) && (
              <div className="flex flex-wrap gap-6">
                {members.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-text-tertiary">Membros</p>
                    <div className="flex -space-x-2">
                      {members.map((m) => (
                        <Avatar key={m.id} name={m.name} src={m.avatarUrl} size="md" className="ring-2 ring-card" />
                      ))}
                    </div>
                  </div>
                )}
                {taskLabels.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-text-tertiary">Etiquetas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {taskLabels.map((l) => (
                        <span key={l.id} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-text-primary", colorClasses(l.color)?.soft)}>
                          <span className={cn("h-2 w-2 rounded-full", colorClasses(l.color)?.dot)} />
                          {l.name || "Etiqueta"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {due && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-text-tertiary">Prazo</p>
                    <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs font-medium", DUE_CHIP[due])}>{DUE_LABEL[due]}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-text-tertiary">
                Responsável
                <select
                  disabled={!canEdit}
                  value={task.assignee?.id ?? ""}
                  onChange={(e) => {
                    const person = users.find((u) => u.id === e.target.value) ?? null;
                    callbacks.patch(task.id, { assignee: person }, { assigneeUserId: e.target.value || null });
                  }}
                  className={fieldClass}
                >
                  <option value="">Sem responsável</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.id === currentUserId ? " (você)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-text-tertiary">
                Prioridade
                <select
                  disabled={!canEdit}
                  value={task.priority}
                  onChange={(e) => {
                    const priority = e.target.value as BoardTask["priority"];
                    callbacks.patch(task.id, { priority }, { priority });
                  }}
                  className={fieldClass}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-text-tertiary">
                Início
                <input
                  type="date"
                  disabled={!canEdit}
                  value={dateInputValue(task.startDate)}
                  onChange={(e) => callbacks.patch(task.id, { startDate: e.target.value ? `${e.target.value}T12:00:00.000Z` : null }, { startDate: e.target.value || null })}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-text-tertiary">
                Prazo
                <input
                  type="date"
                  disabled={!canEdit}
                  value={dateInputValue(task.dueDate)}
                  onChange={(e) => callbacks.patch(task.id, { dueDate: e.target.value ? `${e.target.value}T12:00:00.000Z` : null }, { dueDate: e.target.value || null })}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-text-tertiary">
                Cliente
                <select
                  disabled={!canEdit}
                  value={task.client?.id ?? ""}
                  onChange={(e) => {
                    const client = clients.find((c) => c.id === e.target.value) ?? null;
                    callbacks.patch(task.id, { client }, { clientId: e.target.value || null });
                  }}
                  className={fieldClass}
                >
                  <option value="">Nenhum</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-text-tertiary">
                Projeto
                <select
                  disabled={!canEdit}
                  value={task.project?.id ?? ""}
                  onChange={(e) => {
                    const project = projects.find((p) => p.id === e.target.value) ?? null;
                    callbacks.patch(task.id, { project }, { projectId: e.target.value || null });
                  }}
                  className={fieldClass}
                >
                  <option value="">Nenhum</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <section className="flex flex-col gap-3">
              <h3 className={sectionTitle}>
                <AlignLeft size={16} className="text-text-tertiary" /> Descrição
              </h3>
              {editingDescription ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalhes, briefing, referências, o que precisa ser entregue..."
                    className="w-full rounded-2xl border border-border bg-card p-3.5 text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveDescription} className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90">
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDescription(task.description ?? "");
                        setEditingDescription(false);
                      }}
                      className="h-9 rounded-full px-4 text-sm font-medium text-text-secondary hover:bg-card-elevated"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setEditingDescription(true)}
                  className={cn(
                    "w-full whitespace-pre-wrap rounded-2xl px-3.5 py-3 text-left text-sm leading-relaxed transition-colors",
                    task.description ? "text-text-secondary hover:bg-card-elevated" : "bg-card-elevated text-text-tertiary hover:bg-border/60",
                  )}
                >
                  {task.description || "Adicione uma descrição mais detalhada…"}
                </button>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className={sectionTitle}>
                  <CheckSquare size={16} className="text-text-tertiary" /> Checklist
                </h3>
                {checklist.length > 0 && (
                  <span className="lb-figures text-xs font-medium text-text-secondary">
                    {checklistDone}/{checklist.length}
                  </span>
                )}
              </div>
              {checklist.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="lb-figures w-9 text-xs text-text-tertiary">{progress}%</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-card-elevated">
                    <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-success" : "bg-accent")} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              <ul className="flex flex-col gap-1">
                {checklist.map((item) => (
                  <li key={item.id} className="group/item flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-card-elevated">
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled={!canEdit}
                      onChange={() => {
                        setDetails((d) => d && { ...d, checklist: d.checklist.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)) });
                        run(() => toggleChecklistItemAction(item.id));
                      }}
                      className="h-4 w-4 shrink-0 rounded accent-[var(--lh-accent)]"
                      aria-label={item.text}
                    />
                    {editingItem?.id === item.id ? (
                      <input
                        autoFocus
                        value={editingItem.text}
                        onChange={(e) => setEditingItem({ id: item.id, text: e.target.value })}
                        onBlur={() => {
                          const text = editingItem.text.trim();
                          setEditingItem(null);
                          if (text && text !== item.text) run(() => updateChecklistItemAction(item.id, text));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditingItem(null);
                        }}
                        className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm text-text-primary focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setEditingItem({ id: item.id, text: item.text })}
                        className={cn("min-w-0 flex-1 text-left text-sm", item.done ? "text-text-tertiary line-through" : "text-text-primary")}
                      >
                        {item.text}
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setDetails((d) => d && { ...d, checklist: d.checklist.filter((c) => c.id !== item.id) });
                          run(() => deleteChecklistItemAction(item.id));
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary opacity-0 hover:bg-card hover:text-error group-hover/item:opacity-100 focus:opacity-100"
                        aria-label={`Remover ${item.text}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = newItem.trim();
                    if (!text) return;
                    setNewItem("");
                    run(() => addChecklistItemAction(task.id, text));
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Adicionar item (Enter)"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
                    aria-label="Novo item do checklist"
                  />
                  <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card-elevated text-text-secondary hover:bg-border/60" aria-label="Adicionar item">
                    <Plus size={16} />
                  </button>
                </form>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className={sectionTitle}>
                  <Link2 size={16} className="text-text-tertiary" /> Links e arquivos
                </h3>
                {canEdit && !addingLink && (
                  <button type="button" onClick={() => setAddingLink(true)} className="text-sm font-medium text-accent-light hover:underline">
                    Adicionar link
                  </button>
                )}
              </div>
              {details?.attachments.length ? (
                <ul className="flex flex-col gap-1.5">
                  {details.attachments.map((a) => (
                    <li key={a.id} className="group/link flex items-center gap-3 rounded-xl bg-card-elevated px-3 py-2">
                      <ExternalLink size={14} className="shrink-0 text-text-tertiary" />
                      <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary hover:text-accent-light">
                        {a.name}
                      </a>
                      <span className="hidden shrink-0 text-xs text-text-tertiary sm:inline">{relativeTime(a.createdAt, now)}</span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => run(() => deleteTaskAttachmentAction(a.id))}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary opacity-0 hover:text-error group-hover/link:opacity-100 focus:opacity-100"
                          aria-label={`Remover ${a.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                !addingLink && <p className="text-sm text-text-tertiary">Drive, Canva, Figma, referências — cole o link aqui para ninguém se perder.</p>
              )}
              {addingLink && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => addTaskAttachmentAction(task.id, linkName, linkUrl), () => {
                      setLinkName("");
                      setLinkUrl("");
                      setAddingLink(false);
                    });
                  }}
                  className="flex flex-col gap-2 rounded-2xl border border-border p-3"
                >
                  <input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className={fieldClass} aria-label="Endereço do link" />
                  <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Nome (opcional) — ex: Roteiro aprovado" className={fieldClass} aria-label="Nome do link" />
                  <div className="flex gap-2">
                    <button type="submit" className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90">
                      Salvar link
                    </button>
                    <button type="button" onClick={() => setAddingLink(false)} className="h-9 rounded-full px-4 text-sm font-medium text-text-secondary hover:bg-card-elevated">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className={sectionTitle}>
                  <MessageSquare size={16} className="text-text-tertiary" /> Comentários e atividade
                </h3>
                <button type="button" onClick={() => setShowActivity((v) => !v)} className="text-sm font-medium text-text-secondary hover:text-text-primary">
                  {showActivity ? "Ocultar atividade" : "Mostrar atividade"}
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = comment.trim();
                  if (!body) return;
                  setComment("");
                  run(() => addTaskCommentAction(task.id, body));
                }}
                className="flex items-start gap-3"
              >
                <Avatar name={users.find((u) => u.id === currentUserId)?.name ?? "Você"} src={users.find((u) => u.id === currentUserId)?.avatarUrl} size="md" className="shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <textarea
                    rows={comment ? 3 : 1}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
                    }}
                    placeholder="Escreva um comentário… (Ctrl+Enter envia)"
                    className="w-full resize-none rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
                    aria-label="Novo comentário"
                  />
                  {comment && (
                    <button type="submit" className="h-9 self-start rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90">
                      Comentar
                    </button>
                  )}
                </div>
              </form>
              {!details ? (
                <p className="text-sm text-text-tertiary">Carregando…</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {timeline.map((item) =>
                    item.kind === "comment" ? (
                      <li key={item.id} className="group/comment flex items-start gap-3">
                        <Avatar name={item.data.userName} src={item.data.avatarUrl} size="md" className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-semibold text-text-primary">{item.data.userName}</span>{" "}
                            <span className="text-xs text-text-tertiary">{relativeTime(item.at, now)}</span>
                          </p>
                          <p className="mt-1 whitespace-pre-wrap rounded-2xl rounded-tl-md bg-card-elevated px-3.5 py-2.5 text-sm text-text-secondary">{item.data.body}</p>
                          {(item.data.userId === currentUserId || permissions.canDelete) && (
                            <button
                              type="button"
                              onClick={() => run(() => deleteTaskCommentAction(item.id))}
                              className="mt-1 text-xs text-text-tertiary opacity-0 hover:text-error group-hover/comment:opacity-100 focus:opacity-100"
                            >
                              Apagar
                            </button>
                          )}
                        </div>
                      </li>
                    ) : (
                      <li key={item.id} className="flex items-center gap-3 pl-1 text-xs text-text-tertiary">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card-elevated text-[10px] font-semibold text-text-secondary">
                          {item.data.userName.slice(0, 1)}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium text-text-secondary">{item.data.userName}</span> {describeActivity(item.data.action, item.data.metadata)} ·{" "}
                          {relativeTime(item.at, now)}
                        </span>
                      </li>
                    ),
                  )}
                  {timeline.length === 0 && <li className="text-sm text-text-tertiary">Nenhum comentário ainda.</li>}
                </ol>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-5">
            {canEdit && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-text-tertiary">Adicionar ao cartão</p>
                <Popover
                  trigger={({ toggle }) => (
                    <button type="button" onClick={toggle} className={sideButton}>
                      <Users size={15} /> Membros
                    </button>
                  )}
                >
                  <div className="flex w-64 flex-col gap-1">
                    <p className="px-2 pb-1 text-xs font-medium text-text-tertiary">Quem participa deste cartão</p>
                    {users.map((u) => {
                      const active = task.memberIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => callbacks.toggleMember(task.id, u.id)}
                          className={cn("flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm", active ? "bg-card-elevated text-text-primary" : "text-text-secondary hover:bg-card-elevated")}
                        >
                          <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                          <span className="flex-1 truncate">{u.name}</span>
                          {active && <CheckSquare size={14} className="text-success" />}
                        </button>
                      );
                    })}
                  </div>
                </Popover>
                <Popover
                  trigger={({ toggle }) => (
                    <button type="button" onClick={toggle} className={sideButton}>
                      <Tag size={15} /> Etiquetas
                    </button>
                  )}
                >
                  <div className="flex w-72 flex-col gap-1">
                    <p className="px-2 pb-1 text-xs font-medium text-text-tertiary">Etiquetas do quadro</p>
                    {labels.map((l) => {
                      const active = task.labelIds.includes(l.id);
                      return (
                        <div key={l.id} className="group/label flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => callbacks.toggleLabel(task.id, l.id)}
                            className={cn("flex flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm", active ? "bg-card-elevated text-text-primary" : "text-text-secondary hover:bg-card-elevated")}
                          >
                            <span className={cn("h-3 w-6 rounded-full", colorClasses(l.color)?.dot)} />
                            <span className="flex-1 truncate">{l.name || "Sem nome"}</span>
                            {active && <CheckSquare size={14} className="text-success" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Excluir a etiqueta "${l.name || "sem nome"}" de todo o quadro?`)) run(() => deleteLabelAction(l.id));
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary opacity-0 hover:text-error group-hover/label:opacity-100 focus:opacity-100"
                            aria-label={`Excluir etiqueta ${l.name}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(() => createLabelAction(boardId, newLabel.name, newLabel.color), () => setNewLabel({ name: "", color: newLabel.color }));
                      }}
                      className="mt-2 flex flex-col gap-2 border-t border-border px-2 pt-3"
                    >
                      <input
                        value={newLabel.name}
                        onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                        placeholder="Nova etiqueta"
                        className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-text-primary focus:outline-none"
                        aria-label="Nome da nova etiqueta"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {TASK_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewLabel({ ...newLabel, color: c })}
                            className={cn("h-6 w-6 rounded-full", colorClasses(c)?.dot, newLabel.color === c && "ring-2 ring-text-primary ring-offset-2 ring-offset-card")}
                            aria-label={TASK_COLOR_LABELS[c]}
                          />
                        ))}
                      </div>
                      <button type="submit" className="h-9 rounded-full bg-ink text-sm font-medium text-ink-on hover:opacity-90">
                        Criar etiqueta
                      </button>
                    </form>
                  </div>
                </Popover>
                <Popover
                  trigger={({ toggle }) => (
                    <button type="button" onClick={toggle} className={sideButton}>
                      <ImageIcon size={15} /> Capa
                    </button>
                  )}
                >
                  {(close) => (
                    <div className="flex w-60 flex-col gap-3 p-1">
                      <p className="text-xs font-medium text-text-tertiary">Cor do cartão</p>
                      <div className="grid grid-cols-4 gap-2">
                        {TASK_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              close();
                              callbacks.patch(task.id, { coverColor: c }, { coverColor: c });
                            }}
                            className={cn("h-10 rounded-xl border", colorClasses(c)?.tint, task.coverColor === c && "ring-2 ring-text-primary")}
                            aria-label={TASK_COLOR_LABELS[c]}
                            title={TASK_COLOR_LABELS[c]}
                          />
                        ))}
                      </div>
                      {task.coverColor && (
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            callbacks.patch(task.id, { coverColor: null }, { coverColor: null });
                          }}
                          className="h-9 rounded-full bg-card-elevated text-sm font-medium text-text-secondary hover:bg-border/60"
                        >
                          Remover capa
                        </button>
                      )}
                    </div>
                  )}
                </Popover>
              </div>
            )}

            {canEdit && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-text-tertiary">Mover</p>
                <label className="flex items-center gap-2 rounded-xl bg-card-elevated px-3 text-sm text-text-secondary">
                  <ArrowRightLeft size={15} className="shrink-0" />
                  <select
                    value={task.listId}
                    onChange={(e) => callbacks.move(task.id, e.target.value)}
                    className="h-9 min-w-0 flex-1 bg-transparent font-medium text-text-secondary focus:outline-none"
                    aria-label="Mover para a lista"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                {boards.length > 1 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const target = boards.find((b) => b.id === e.target.value);
                      if (target?.firstListId) callbacks.move(task.id, target.firstListId, target.id);
                    }}
                    className="h-9 rounded-xl bg-card-elevated px-3 text-sm font-medium text-text-secondary focus:outline-none"
                    aria-label="Mover para outro quadro"
                  >
                    <option value="">Outro quadro…</option>
                    {boards
                      .filter((b) => b.id !== boardId && b.firstListId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-text-tertiary">Ações</p>
              {permissions.canCreate && (
                <button type="button" onClick={() => callbacks.duplicate(task.id)} className={sideButton}>
                  <Copy size={15} /> Duplicar
                </button>
              )}
              {canEdit && (
                <button type="button" onClick={() => callbacks.archive(task.id)} className={sideButton}>
                  <Archive size={15} /> Arquivar
                </button>
              )}
              {permissions.canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Excluir "${task.title}" de vez? Isso não pode ser desfeito.`)) callbacks.remove(task.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl bg-error/10 px-3 py-2 text-left text-sm font-medium text-error hover:bg-error/15"
                >
                  <Trash2 size={15} /> Excluir
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
