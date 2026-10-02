// Paleta compartilhada por quadros, etiquetas e capas de cartão. As classes
// ficam escritas por extenso para o Tailwind encontrá-las no build.
export const TASK_COLORS = ["orange", "rose", "violet", "blue", "teal", "green", "yellow", "slate"] as const;
export type TaskColor = (typeof TASK_COLORS)[number];

export const TASK_COLOR_LABELS: Record<TaskColor, string> = {
  orange: "Laranja",
  rose: "Rosa",
  violet: "Roxo",
  blue: "Azul",
  teal: "Verde-água",
  green: "Verde",
  yellow: "Amarelo",
  slate: "Cinza",
};

export const TASK_COLOR_CLASSES: Record<TaskColor, { dot: string; soft: string; tint: string; bar: string }> = {
  orange: { dot: "bg-orange-500", soft: "bg-orange-500/15", tint: "bg-orange-500/10 border-orange-500/30", bar: "bg-orange-500" },
  rose: { dot: "bg-rose-500", soft: "bg-rose-500/15", tint: "bg-rose-500/10 border-rose-500/30", bar: "bg-rose-500" },
  violet: { dot: "bg-violet-500", soft: "bg-violet-500/15", tint: "bg-violet-500/10 border-violet-500/30", bar: "bg-violet-500" },
  blue: { dot: "bg-blue-500", soft: "bg-blue-500/15", tint: "bg-blue-500/10 border-blue-500/30", bar: "bg-blue-500" },
  teal: { dot: "bg-teal-500", soft: "bg-teal-500/15", tint: "bg-teal-500/10 border-teal-500/30", bar: "bg-teal-500" },
  green: { dot: "bg-green-500", soft: "bg-green-500/15", tint: "bg-green-500/10 border-green-500/30", bar: "bg-green-500" },
  yellow: { dot: "bg-yellow-400", soft: "bg-yellow-400/20", tint: "bg-yellow-400/12 border-yellow-400/40", bar: "bg-yellow-400" },
  slate: { dot: "bg-slate-400", soft: "bg-slate-400/20", tint: "bg-slate-400/10 border-slate-400/30", bar: "bg-slate-400" },
};

export function isTaskColor(value: unknown): value is TaskColor {
  return typeof value === "string" && (TASK_COLORS as readonly string[]).includes(value);
}

export function colorClasses(value: string | null | undefined) {
  return isTaskColor(value) ? TASK_COLOR_CLASSES[value] : null;
}
