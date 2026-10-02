"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireDirector } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; error: string };

const pct = z.number().min(0, "Taxas não podem ser negativas.").max(80, "Confira as taxas: algum valor passou de 80%.");
const optionalText = (max: number) => z.string().trim().max(max).optional();

const settingsSchema = z.object({
  debitFee: pct,
  rows: z
    .array(z.object({ n: z.number().int().min(1).max(18), seller: pct, buyer: pct }))
    .min(1)
    .max(18),
  creditMargin: z.number().min(0).max(50, "A margem do crédito precisa ficar entre 0% e 50%."),
  maxInstallments: z.number().int().min(1).max(18),
  validityDays: z.number().int().min(1).max(90),
  pixKey: optionalText(140),
  whatsappTemplate: optionalText(2000),
  contractMessage: optionalText(2000),
  companyLegalName: optionalText(160),
  companyDocument: optionalText(30),
  companyAddress: optionalText(300),
  companyCity: optionalText(80),
  representativeName: optionalText(120),
  representativeEmail: z.union([z.literal(""), z.string().trim().email("E-mail do representante inválido.")]).optional(),
  representativeDoc: optionalText(30),
});

export type PricingSettingsInput = z.input<typeof settingsSchema>;

export async function savePricingSettingsAction(input: PricingSettingsInput): Promise<Result> {
  const user = await requireDirector();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os dados." };
  const d = parsed.data;

  const rows = [...new Map(d.rows.map((r) => [r.n, r])).values()].sort((a, b) => a.n - b.n);
  if (!rows.some((r) => r.n === 1)) return { ok: false, error: "A tabela precisa ter a taxa do crédito à vista (1x)." };

  const data = {
    debitFee: d.debitFee,
    installmentFees: rows,
    creditMargin: d.creditMargin,
    maxInstallments: Math.min(d.maxInstallments, Math.max(...rows.map((r) => r.n))),
    validityDays: d.validityDays,
    pixKey: d.pixKey || null,
    whatsappTemplate: d.whatsappTemplate || null,
    contractTemplateMsg: d.contractMessage || null,
    companyLegalName: d.companyLegalName || null,
    companyDocument: d.companyDocument || null,
    companyAddress: d.companyAddress || null,
    companyCity: d.companyCity || null,
    representativeName: d.representativeName || null,
    representativeEmail: d.representativeEmail || null,
    representativeDoc: d.representativeDoc || null,
  };

  await db.pricingSettings.upsert({
    where: { organizationId: user.organizationId },
    create: { organizationId: user.organizationId, ...data },
    update: data,
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PRICING_SETTINGS_UPDATED",
    entityType: "PricingSettings",
    metadata: { creditMargin: d.creditMargin, maxInstallments: data.maxInstallments },
  });

  revalidatePath("/propostas", "layout");
  revalidatePath("/crm/servicos");
  return { ok: true };
}
