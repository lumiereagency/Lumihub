import { z } from "zod";

export const DOCUMENT_CATEGORIES = [
  "CONTRATO",
  "PROPOSTA",
  "BRIEFING",
  "COMPROVANTE",
  "NOTA_FISCAL",
  "DOCUMENTO_CLIENTE",
  "DOCUMENTO_EQUIPE",
  "OUTRO",
] as const;

export const DOCUMENT_CATEGORY_LABELS: Record<(typeof DOCUMENT_CATEGORIES)[number], string> = {
  CONTRATO: "Contrato",
  PROPOSTA: "Proposta",
  BRIEFING: "Briefing",
  COMPROVANTE: "Comprovante",
  NOTA_FISCAL: "Nota fiscal",
  DOCUMENTO_CLIENTE: "Documento do cliente",
  DOCUMENTO_EQUIPE: "Documento da equipe",
  OUTRO: "Outro",
};

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const documentMetadataSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do documento."),
  category: z.enum(DOCUMENT_CATEGORIES, { error: "Selecione a categoria." }),
  clientId: z.preprocess(emptyToUndefined, z.string().optional()),
  projectId: z.preprocess(emptyToUndefined, z.string().optional()),
});
