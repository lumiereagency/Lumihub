import { z } from "zod";

export const PROPOSAL_STATUSES = ["RASCUNHO", "ENVIADA", "EM_NEGOCIACAO", "ACEITA", "RECUSADA", "EXPIRADA"] as const;

export const PROPOSAL_STATUS_LABELS: Record<(typeof PROPOSAL_STATUSES)[number], string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  EM_NEGOCIACAO: "Em negociação",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  EXPIRADA: "Expirada",
};

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const proposalSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título da proposta."),
    leadId: z.preprocess(emptyToUndefined, z.string().optional()),
    clientId: z.preprocess(emptyToUndefined, z.string().optional()),
    value: z.coerce.number().positive("Informe um valor maior que zero."),
    validUntil: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  })
  .refine((data) => data.leadId || data.clientId, {
    message: "Vincule a proposta a um lead ou a um cliente.",
    path: ["leadId"],
  });
