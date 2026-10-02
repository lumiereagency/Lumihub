import type { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/validation/tasks";

export type TaskStatusKey = (typeof TASK_STATUSES)[number];
export type TaskPriorityKey = (typeof TASK_PRIORITIES)[number];

export interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  listId: string;
  position: number;
  status: TaskStatusKey;
  priority: TaskPriorityKey;
  coverColor: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  assignee: Person | null;
  memberIds: string[];
  labelIds: string[];
  project: { id: string; name: string } | null;
  client: { id: string; companyName: string } | null;
  checklistDone: number;
  checklistTotal: number;
  commentCount: number;
  attachmentCount: number;
  pending?: boolean;
}

export interface BoardList {
  id: string;
  name: string;
  status: TaskStatusKey;
  position: number;
}

export interface BoardLabel {
  id: string;
  name: string;
  color: string;
}

export interface BoardSummary {
  id: string;
  name: string;
  color: string;
  openCount: number;
  firstListId: string | null;
}

export interface TaskPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export const POSITION_STEP = 1024;
const DAY = 24 * 60 * 60 * 1000;

export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return POSITION_STEP;
  if (before === undefined) return after! / 2;
  if (after === undefined) return before + POSITION_STEP;
  return (before + after) / 2;
}

export type DueState = "done" | "overdue" | "today" | "soon" | "later";

export function dueState(task: Pick<BoardTask, "dueDate" | "completedAt" | "status">, now: number): DueState | null {
  if (!task.dueDate) return null;
  if (task.completedAt || task.status === "CONCLUIDA") return "done";
  const dueDay = Date.parse(`${task.dueDate.slice(0, 10)}T00:00:00Z`);
  // "Hoje" segue o horário de Brasília, igual no servidor (UTC) e no navegador.
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  const todayDay = Date.parse(`${todayIso}T00:00:00Z`);
  if (dueDay < todayDay) return "overdue";
  if (dueDay === todayDay) return "today";
  if (dueDay - todayDay <= 2 * DAY) return "soon";
  return "later";
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).replace(".", "");
}

export function dateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export const DUE_CHIP: Record<DueState, string> = {
  done: "bg-success text-white",
  overdue: "bg-error text-white",
  today: "bg-warning text-black/80",
  soon: "bg-warning/15 text-text-primary",
  later: "bg-card-elevated text-text-secondary",
};

export const DUE_LABEL: Record<DueState, string> = {
  done: "Concluída",
  overdue: "Atrasada",
  today: "Vence hoje",
  soon: "Vence em breve",
  later: "No prazo",
};

export const PRIORITY_META: Record<TaskPriorityKey, { label: string; className: string; dot: string }> = {
  BAIXA: { label: "Baixa", className: "text-text-tertiary", dot: "bg-text-tertiary" },
  MEDIA: { label: "Média", className: "text-info", dot: "bg-info" },
  ALTA: { label: "Alta", className: "text-warning", dot: "bg-warning" },
  URGENTE: { label: "Urgente", className: "text-error", dot: "bg-error" },
};

export const STATUS_META: Record<TaskStatusKey, { label: string; dot: string }> = {
  A_FAZER: { label: "A fazer", dot: "bg-text-tertiary" },
  EM_ANDAMENTO: { label: "Em andamento", dot: "bg-info" },
  EM_REVISAO: { label: "Em revisão", dot: "bg-warning" },
  CONCLUIDA: { label: "Concluída", dot: "bg-success" },
};

export function relativeTime(iso: string, now: number): string {
  const min = Math.round((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
