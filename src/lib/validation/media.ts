import { z } from "zod";

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor no formato #RRGGBB.");
const timeOfDay = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido (HH:MM).");

export const mediaMemberRoleSchema = z.enum(["LIDER", "MEMBRO"]);

export const inviteMediaMemberSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  phone: z.string().trim().optional().default(""),
  role: mediaMemberRoleSchema,
});

export const updateMediaMemberSchema = z.object({
  role: mediaMemberRoleSchema,
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  phone: z.string().trim().optional().default(""),
  administrativeNotes: z.string().trim().optional().default(""),
});

export const mediaFunctionSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da função."),
  description: z.string().trim().optional().default(""),
  active: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(true),
});

export const memberFunctionAssignSchema = z.object({
  functionId: z.string().min(1, "Selecione uma função."),
  isPrimary: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
  status: z.enum(["EM_TREINAMENTO", "HABILITADO", "AVANCADO"]).default("HABILITADO"),
});

export const mediaBrandSettingsSchema = z.object({
  environmentName: z.string().trim().min(1, "Informe o nome do ambiente."),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  gradientStart: hexColor,
  gradientEnd: hexColor,
});

export const availabilityRecurringItemSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: timeOfDay,
    endTime: timeOfDay,
    available: z.boolean(),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "O horário final deve ser depois do horário inicial.",
    path: ["endTime"],
  });

export const availabilityRecurringSchema = z.object({
  slots: z.array(availabilityRecurringItemSchema),
});

export const availabilityExceptionSchema = z
  .object({
    date: z.string().trim().min(1, "Informe a data."),
    startTime: timeOfDay,
    endTime: timeOfDay,
    available: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
    reason: z.string().trim().optional().default(""),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "O horário final deve ser depois do horário inicial.",
    path: ["endTime"],
  });

export const myMediaProfileSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  phone: z.string().trim().optional().default(""),
});

// Pesos da IA de escala (Fase 03, §8) — só os critérios preferenciais são
// configuráveis; disponibilidade/habilitação/conflito continuam
// obrigatórios e nunca aparecem aqui. 0 desliga o critério por completo.
export const mediaAIWeightsSchema = z.object({
  aiWeightWorkload: z.coerce.number().int().min(0).max(100),
  aiWeightRecency: z.coerce.number().int().min(0).max(100),
  aiWeightPreference: z.coerce.number().int().min(0).max(100),
});
