import { z } from "zod";
import { parseLocalDateTime } from "@/lib/datetime";

export const CALENDAR_EVENT_TYPES = [
  "CAPTACAO",
  "REUNIAO",
  "ENTREGA",
  "VENCIMENTO",
  "COBRANCA",
  "CONTRATO",
  "TAREFA",
  "INTERNO",
  "MIDIA",
] as const;

export const CALENDAR_EVENT_TYPE_LABELS: Record<(typeof CALENDAR_EVENT_TYPES)[number], string> = {
  CAPTACAO: "Captação",
  REUNIAO: "Reunião",
  ENTREGA: "Entrega",
  VENCIMENTO: "Vencimento",
  COBRANCA: "Cobrança",
  CONTRATO: "Contrato",
  TAREFA: "Tarefa",
  INTERNO: "Evento interno",
  MIDIA: "Mídia ADESF",
};

// Tipos gerados automaticamente por outros módulos (Captações, Projetos,
// Contratos) — só podem ser criados manualmente pelo formulário genérico
// os demais, para não divergir da fonte de verdade.
export const MANUALLY_CREATABLE_TYPES = ["REUNIAO", "VENCIMENTO", "COBRANCA", "TAREFA", "INTERNO"] as const;

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const calendarEventSchema = z.object({
  title: z.string().trim().min(1, "Informe o título do evento."),
  type: z.enum(MANUALLY_CREATABLE_TYPES).default("REUNIAO"),
  startAt: z.preprocess(parseLocalDateTime, z.coerce.date({ error: "Informe a data e horário do evento." })),
  endAt: z.preprocess((v) => parseLocalDateTime(emptyToUndefined(v)), z.coerce.date().optional()),
  allDay: z.boolean().default(false),
  clientId: z.preprocess(emptyToUndefined, z.string().optional()),
  projectId: z.preprocess(emptyToUndefined, z.string().optional()),
  responsibleUserId: z.preprocess(emptyToUndefined, z.string().optional()),
  location: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type CalendarEventInput = z.infer<typeof calendarEventSchema>;
