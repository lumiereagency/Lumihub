import { z } from "zod";
import { parseLocalDateTime } from "@/lib/datetime";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const mediaEventRequirementInputSchema = z.object({
  functionId: z.string().min(1),
  requiredQuantity: z.coerce.number().int().min(1).max(20),
  mandatory: z.boolean(),
});

export const mediaEventSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do culto/evento."),
  type: z.string().trim().min(1).default("Culto"),
  startAt: z.preprocess(parseLocalDateTime, z.coerce.date({ error: "Informe a data e horário do evento." })),
  endAt: z.preprocess((v) => parseLocalDateTime(emptyToUndefined(v)), z.coerce.date().optional()),
  location: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  administrativeNotes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  requirements: z.array(mediaEventRequirementInputSchema).default([]),
});

export const mediaEventRecurrenceSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da série."),
    type: z.string().trim().min(1).default("Culto"),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido."),
    endTime: z.preprocess(emptyToUndefined, z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()),
    location: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    startDate: z.string().trim().min(1, "Informe a data inicial."),
    endDate: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  })
  .refine((v) => !v.endTime || v.startTime < v.endTime, { message: "O horário final deve ser depois do inicial.", path: ["endTime"] });

export const createMonthlyScheduleSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
});

export const requestSwapSchema = z.object({
  targetMemberId: z.string().min(1, "Selecione um membro para a troca."),
  reason: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export const swapDecisionSchema = z.object({
  decisionNotes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});
