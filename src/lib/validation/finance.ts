import { z } from "zod";

export const FINANCIAL_CATEGORY_TYPES = ["RECEITA", "DESPESA"] as const;

export const FINANCIAL_CATEGORY_TYPE_LABELS: Record<(typeof FINANCIAL_CATEGORY_TYPES)[number], string> = {
  RECEITA: "Receita",
  DESPESA: "Despesa",
};

export const financialCategorySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da categoria."),
  type: z.enum(FINANCIAL_CATEGORY_TYPES).default("DESPESA"),
});

export const costCenterSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do centro de custo."),
});
