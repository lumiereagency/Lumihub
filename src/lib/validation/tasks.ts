import { z } from "zod";

export const TASK_STATUSES = ["A_FAZER", "EM_ANDAMENTO", "EM_REVISAO", "CONCLUIDA"] as const;

export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  A_FAZER: "A fazer",
  EM_ANDAMENTO: "Em andamento",
  EM_REVISAO: "Em revisão",
  CONCLUIDA: "Concluída",
};

export const TASK_PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"] as const;

export const TASK_PRIORITY_LABELS: Record<(typeof TASK_PRIORITIES)[number], string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Informe o título da tarefa."),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  projectId: z.preprocess(emptyToUndefined, z.string().optional()),
  assigneeUserId: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.enum(TASK_STATUSES).default("A_FAZER"),
  priority: z.enum(TASK_PRIORITIES).default("MEDIA"),
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

export type TaskInput = z.infer<typeof taskSchema>;
