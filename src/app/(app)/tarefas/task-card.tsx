"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, CheckSquare, Clock, Flag, Link2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { colorClasses } from "@/lib/tasks/colors";
import { Avatar } from "@/components/ui/avatar";
import { DUE_CHIP, PRIORITY_META, dueState, shortDate, type BoardLabel, type BoardTask, type Person } from "./task-ui";

const PROGRESS_DOTS = 10;

export function TaskCardView({
  task,
  labels,
  people,
  now,
  dragging = false,
  overlay = false,
}: {
  task: BoardTask;
  labels: Map<string, BoardLabel>;
  people: Map<string, Person>;
  now: number;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const cover = colorClasses(task.coverColor);
  const due = dueState(task, now);
  const taskLabels = task.labelIds.map((id) => labels.get(id)).filter((l): l is BoardLabel => !!l);
  const avatars = [task.assignee, ...task.memberIds.filter((id) => id !== task.assignee?.id).map((id) => people.get(id))].filter(
    (p): p is Person => !!p,
  );
  const progress = task.checklistTotal > 0 ? task.checklistDone / task.checklistTotal : 0;
  const filledDots = Math.round(progress * PROGRESS_DOTS);
  const priority = PRIORITY_META[task.priority];
  const isDone = task.status === "CONCLUIDA";

  return (
    <div
      className={cn(
        "group/card flex flex-col gap-3 rounded-2xl border p-3.5 text-left transition-[box-shadow,border-color,opacity]",
        cover ? cover.tint : "border-border bg-card",
        !overlay && "hover:border-text-tertiary/60 hover:shadow-[0_6px_20px_-12px_rgba(0,0,0,0.5)]",
        dragging && "opacity-30",
        overlay && "rotate-[2.5deg] cursor-grabbing shadow-2xl ring-1 ring-text-tertiary/30",
        task.pending && "opacity-60",
      )}
    >
      {task.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={task.coverUrl} alt="" loading="lazy" draggable={false} className="-mx-3.5 -mt-3.5 mb-0 h-36 w-[calc(100%+1.75rem)] max-w-none rounded-t-2xl object-cover" />
      )}
      {taskLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {taskLabels.map((label) => (
            <span
              key={label.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-text-secondary",
                colorClasses(label.color)?.soft ?? "bg-card-elevated",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", colorClasses(label.color)?.dot ?? "bg-text-tertiary")} />
              {label.name || "Etiqueta"}
            </span>
          ))}
        </div>
      )}

      <p className={cn("text-sm font-medium leading-snug text-text-primary", isDone && "text-text-secondary line-through decoration-text-tertiary")}>
        {task.title}
      </p>

      {(task.client || task.project) && (
        <p className="-mt-1.5 truncate text-xs text-text-tertiary">{task.client?.companyName ?? task.project?.name}</p>
      )}

      {task.checklistTotal > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-text-tertiary">
            <span>Progresso</span>
            <span className="lb-figures font-medium text-text-secondary">{Math.round(progress * 100)}%</span>
          </div>
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: PROGRESS_DOTS }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i < filledDots ? (progress === 1 ? "bg-success" : (cover?.bar ?? "bg-accent")) : "bg-text-tertiary/20",
                )}
              />
            ))}
          </div>
        </div>
      )}

      {(due || task.checklistTotal > 0 || task.commentCount > 0 || task.attachmentCount > 0 || task.description || avatars.length > 0 || task.priority === "ALTA" || task.priority === "URGENTE") && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-text-tertiary">
            {due && task.dueDate && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", DUE_CHIP[due])}>
                <Clock size={11} />
                {shortDate(task.dueDate)}
              </span>
            )}
            {(task.priority === "ALTA" || task.priority === "URGENTE") && (
              <span className={cn("inline-flex items-center gap-0.5 font-medium", priority.className)} title={`Prioridade ${priority.label}`}>
                <Flag size={11} /> {priority.label}
              </span>
            )}
            {task.checklistTotal > 0 && (
              <span className={cn("inline-flex items-center gap-1", progress === 1 && "text-success")}>
                <CheckSquare size={12} /> {task.checklistDone}/{task.checklistTotal}
              </span>
            )}
            {task.commentCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare size={12} /> {task.commentCount}
              </span>
            )}
            {task.attachmentCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Link2 size={12} /> {task.attachmentCount}
              </span>
            )}
            {task.description && <AlignLeft size={12} aria-label="Tem descrição" />}
          </div>
          {avatars.length > 0 && (
            <div className="flex shrink-0 -space-x-1.5">
              {avatars.slice(0, 3).map((p) => (
                <Avatar key={p.id} name={p.name} src={p.avatarUrl} size="sm" className="ring-2 ring-card" />
              ))}
              {avatars.length > 3 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card-elevated text-[10px] font-medium text-text-secondary ring-2 ring-card">
                  +{avatars.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SortableTaskCard({
  task,
  labels,
  people,
  now,
  disabled,
  onOpen,
}: {
  task: BoardTask;
  labels: Map<string, BoardLabel>;
  people: Map<string, Person>;
  now: number;
  disabled: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "card", listId: task.listId },
    disabled: disabled || task.pending,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`Abrir cartão ${task.title}`}
      onClick={() => !task.pending && onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !task.pending) onOpen(task.id);
        listeners?.onKeyDown?.(e);
      }}
      className="cursor-pointer touch-manipulation rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <TaskCardView task={task} labels={labels} people={people} now={now} dragging={isDragging} />
    </div>
  );
}
