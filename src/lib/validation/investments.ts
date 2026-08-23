import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/validation/shared";

export const INVESTMENT_CATEGORIES = [
  "Equipamentos",
  "Tecnologia",
  "Marketing",
  "Estrutura",
  "Desenvolvimento",
  "Expansão",
  "Outros",
] as const;

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const investmentSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição."),
  category: z.string().trim().min(1, "Informe a categoria."),
  amount: z.coerce.number().positive("Informe um valor maior que zero."),
  date: z.coerce.date({ error: "Informe a data." }),
  paymentMethod: z.preprocess(emptyToUndefined, z.enum(PAYMENT_METHODS).optional()),
  installments: z.coerce.number().int().min(1).max(60).default(1),
  objective: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  expectedReturn: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});
