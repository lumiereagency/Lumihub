import { z } from "zod";

export const GOAL_TYPES = ["FATURAMENTO", "NOVOS_CLIENTES", "PROSPECCAO", "PROJETOS", "MARGEM", "RECEBIMENTOS"] as const;

export const GOAL_TYPE_LABELS: Record<(typeof GOAL_TYPES)[number], string> = {
  FATURAMENTO: "Faturamento",
  NOVOS_CLIENTES: "Novos clientes",
  PROSPECCAO: "Prospecção",
  PROJETOS: "Projetos concluídos",
  MARGEM: "Margem",
  RECEBIMENTOS: "Recebimentos",
};

export const GOAL_SCENARIOS = ["CONSERVADOR", "REALISTA", "AGRESSIVO"] as const;

export const GOAL_SCENARIO_LABELS: Record<(typeof GOAL_SCENARIOS)[number], string> = {
  CONSERVADOR: "Conservador",
  REALISTA: "Realista",
  AGRESSIVO: "Agressivo",
};

const COUNT_TYPES = new Set(["NOVOS_CLIENTES", "PROSPECCAO", "PROJETOS"]);

export function formatGoalValue(type: (typeof GOAL_TYPES)[number], value: number, currency: string): string {
  if (type === "MARGEM") return `${value.toFixed(1)}%`;
  if (COUNT_TYPES.has(type)) return Math.round(value).toString();
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export const goalSchema = z
  .object({
    type: z.enum(GOAL_TYPES, { error: "Selecione o tipo de meta." }),
    scenario: z.enum(GOAL_SCENARIOS, { error: "Selecione o cenário." }),
    periodStart: z.coerce.date({ error: "Informe o início do período." }),
    periodEnd: z.coerce.date({ error: "Informe o fim do período." }),
    targetValue: z.coerce.number().positive("Informe um valor maior que zero."),
  })
  .refine((data) => data.periodEnd > data.periodStart, {
    message: "O fim do período deve ser depois do início.",
    path: ["periodEnd"],
  });
