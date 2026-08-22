import { z } from "zod";

export const LEAD_STAGES = [
  "LEAD",
  "CONTATO",
  "QUALIFICADO",
  "REUNIAO",
  "PROPOSTA",
  "NEGOCIACAO",
  "FECHADO",
  "PERDIDO",
] as const;

export const LEAD_STAGE_LABELS: Record<(typeof LEAD_STAGES)[number], string> = {
  LEAD: "Lead",
  CONTATO: "Contato",
  QUALIFICADO: "Qualificado",
  REUNIAO: "Reunião",
  PROPOSTA: "Proposta",
  NEGOCIACAO: "Negociação",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
};

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const leadSchema = z.object({
  company: z.string().trim().min(1, "Informe o nome da empresa."),
  contactName: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  whatsapp: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  instagram: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  website: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  segment: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  source: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  ownerUserId: z.preprocess(emptyToUndefined, z.string().optional()),
  potentialValue: z.preprocess(
    emptyToUndefined,
    z.coerce.number().nonnegative("O valor não pode ser negativo.").optional(),
  ),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  stage: z.enum(LEAD_STAGES).default("LEAD"),
  nextContactAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type LeadInput = z.infer<typeof leadSchema>;
