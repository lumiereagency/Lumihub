import { z } from "zod";

export const PAYABLE_STATUSES = ["PENDENTE", "PAGO", "ATRASADO", "CANCELADO"] as const;

export const PAYABLE_STATUS_LABELS: Record<(typeof PAYABLE_STATUSES)[number], string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
};

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const payableSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição."),
  supplier: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().optional()),
  costCenterId: z.preprocess(emptyToUndefined, z.string().optional()),
  amount: z.coerce.number().positive("Informe um valor maior que zero."),
  dueDate: z.coerce.date({ error: "Informe o vencimento." }),
  recurring: z.boolean().default(false),
  installmentTotal: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(60).optional()),
  responsibleUserId: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const confirmPayableSchema = z.object({
  paidAt: z.coerce.date({ error: "Informe a data de pagamento." }),
});
