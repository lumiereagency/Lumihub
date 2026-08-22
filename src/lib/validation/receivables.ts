import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/validation/shared";

export const RECEIVABLE_STATUSES = ["PENDENTE", "PAGO", "ATRASADO", "CANCELADO"] as const;

export const RECEIVABLE_STATUS_LABELS: Record<(typeof RECEIVABLE_STATUSES)[number], string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
};

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const receivableSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente."),
  contractId: z.preprocess(emptyToUndefined, z.string().optional()),
  description: z.string().trim().min(1, "Informe a descrição."),
  amount: z.coerce.number().positive("Informe um valor maior que zero."),
  dueDate: z.coerce.date({ error: "Informe o vencimento." }),
  paymentMethod: z.preprocess(emptyToUndefined, z.enum(PAYMENT_METHODS).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export const confirmPaymentSchema = z.object({
  paidAt: z.coerce.date({ error: "Informe a data de pagamento." }),
  paymentMethod: z.preprocess(emptyToUndefined, z.enum(PAYMENT_METHODS).optional()),
  proofUrl: z.preprocess(emptyToUndefined, z.string().trim().url("Informe uma URL válida.").optional()),
});
