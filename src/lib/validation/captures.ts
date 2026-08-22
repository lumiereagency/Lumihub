import { z } from "zod";

export const CAPTURE_STATUSES = ["PLANEJADA", "CONFIRMADA", "REALIZADA", "EM_EDICAO", "ENTREGUE"] as const;

export const CAPTURE_STATUS_LABELS: Record<(typeof CAPTURE_STATUSES)[number], string> = {
  PLANEJADA: "Planejada",
  CONFIRMADA: "Confirmada",
  REALIZADA: "Realizada",
  EM_EDICAO: "Em edição",
  ENTREGUE: "Entregue",
};

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const captureSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente."),
  projectId: z.preprocess(emptyToUndefined, z.string().optional()),
  date: z.coerce.date({ error: "Informe a data da captação." }),
  location: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  status: z.enum(CAPTURE_STATUSES).default("PLANEJADA"),
  videomaker: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  photographer: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  storymaker: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  droneOperator: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  videoCount: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().optional()),
  photoCount: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().optional()),
  scriptNotes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  equipment: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type CaptureInput = z.infer<typeof captureSchema>;
