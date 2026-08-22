import { z } from "zod";

export const PROJECT_STATUSES = [
  "BACKLOG",
  "PLANEJAMENTO",
  "EM_PRODUCAO",
  "EM_REVISAO",
  "AGUARDANDO_CLIENTE",
  "CONCLUIDO",
  "ATRASADO",
] as const;

export const PROJECT_STATUS_LABELS: Record<(typeof PROJECT_STATUSES)[number], string> = {
  BACKLOG: "Backlog",
  PLANEJAMENTO: "Planejamento",
  EM_PRODUCAO: "Em produção",
  EM_REVISAO: "Em revisão",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  CONCLUIDO: "Concluído",
  ATRASADO: "Atrasado",
};

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const projectSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente."),
  name: z.string().trim().min(1, "Informe o nome do projeto."),
  responsibleUserId: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.enum(PROJECT_STATUSES).default("BACKLOG"),
  startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  value: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  costEstimate: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export const projectTeamMemberSchema = z.object({
  teamMemberId: z.string().min(1, "Selecione um membro da equipe."),
  roleInProject: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  costAllocated: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
});
