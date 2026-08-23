import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const creditCardSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cartão."),
  institution: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  limitAmount: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
});

export const cardTransactionSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição da compra."),
  category: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  totalAmount: z.coerce.number().positive("Informe um valor maior que zero."),
  purchaseDate: z.coerce.date({ error: "Informe a data da compra." }),
  installmentsTotal: z.coerce.number().int().min(1).max(24).default(1),
});
