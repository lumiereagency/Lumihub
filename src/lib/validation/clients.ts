import { z } from "zod";

export const CLIENT_STATUSES = ["ATIVO", "INATIVO", "PROSPECTO", "INADIMPLENTE"] as const;

export const CLIENT_STATUS_LABELS: Record<(typeof CLIENT_STATUSES)[number], string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  PROSPECTO: "Prospecto",
  INADIMPLENTE: "Inadimplente",
};

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const clientSchema = z.object({
  companyName: z.string().trim().min(1, "Informe o nome da empresa."),
  cnpj: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  contactName: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("E-mail inválido.").optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  instagram: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  website: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  status: z.enum(CLIENT_STATUSES).default("ATIVO"),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type ClientInput = z.infer<typeof clientSchema>;
