import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/validation/shared";

export const TEAM_MEMBER_TYPES = ["FUNCIONARIO", "FREELANCER", "PRESTADOR"] as const;

export const TEAM_MEMBER_TYPE_LABELS: Record<(typeof TEAM_MEMBER_TYPES)[number], string> = {
  FUNCIONARIO: "Funcionário",
  FREELANCER: "Freelancer",
  PRESTADOR: "Prestador",
};

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const teamMemberSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  role: z.string().trim().min(1, "Informe a função."),
  type: z.enum(TEAM_MEMBER_TYPES).default("FUNCIONARIO"),
  userId: z.preprocess(emptyToUndefined, z.string().optional()),
  paymentValue: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  paymentMethod: z.preprocess(emptyToUndefined, z.enum(PAYMENT_METHODS).optional()),
  paymentDay: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(31).optional()),
  active: z.boolean().default(true),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;
