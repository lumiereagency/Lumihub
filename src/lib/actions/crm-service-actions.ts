"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireDirector, requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { GUIDE_CATALOG } from "@/lib/pricing/guide-catalog";

type Result = { ok: true } | { ok: false; error: string };

const money = z.number().nonnegative("Valores não podem ser negativos.").max(100_000_000);

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao serviço.").max(120),
  category: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  defaultPrice: money.nullable().optional(),
  billing: z.enum(["MENSAL", "PONTUAL"]).default("PONTUAL"),
  currency: z.enum(["BRL", "USD"]).default("BRL"),
  tagline: z.string().trim().max(160).optional(),
  features: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  badge: z.string().trim().max(30).optional(),
  priceIsFrom: z.boolean().default(false),
  monthlyFee: money.nullable().optional(),
  cardMode: z.enum(["AUTO", "FIXED", "NONE"]).default("AUTO"),
  cardPrice: money.nullable().optional(),
  maxInstallments: z.number().int().min(1).max(18).nullable().optional(),
  minMonths: z.number().int().min(1).max(60).nullable().optional(),
  isAddon: z.boolean().default(false),
  terms: z.string().trim().max(1000).optional(),
});

function done() {
  revalidatePath("/propostas", "layout");
  revalidatePath("/crm");
  revalidatePath("/crm/servicos");
  revalidatePath("/clientes", "layout");
}

export async function saveServiceAction(serviceId: string | null, input: z.input<typeof serviceSchema>): Promise<Result> {
  const user = await requireDirector();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  if (d.cardMode === "FIXED" && d.cardPrice == null) return { ok: false, error: "Informe o valor total no cartão (ex: R$ 1.800 em até 5x)." };
  const data = {
    name: d.name,
    category: d.category || null,
    description: d.description || null,
    defaultPrice: d.defaultPrice ?? null,
    billing: d.billing,
    currency: d.currency,
    tagline: d.tagline || null,
    features: d.features,
    badge: d.badge || null,
    priceIsFrom: d.priceIsFrom,
    monthlyFee: d.monthlyFee ?? null,
    cardMode: d.cardMode,
    cardPrice: d.cardMode === "FIXED" ? (d.cardPrice ?? null) : null,
    maxInstallments: d.maxInstallments ?? null,
    minMonths: d.minMonths ?? null,
    isAddon: d.isAddon,
    terms: d.terms || null,
  };

  if (serviceId) {
    const existing = await db.service.findFirst({ where: { id: serviceId, organizationId: user.organizationId } });
    if (!existing) return { ok: false, error: "Serviço não encontrado." };
    await db.service.update({ where: { id: serviceId }, data });
  } else {
    const created = await db.service.create({ data: { organizationId: user.organizationId, ...data } });
    await audit({ organizationId: user.organizationId, userId: user.id, action: "SERVICE_CREATED", entityType: "Service", entityId: created.id, metadata: { name: created.name } });
  }
  done();
  return { ok: true };
}

export async function toggleServiceActiveAction(serviceId: string): Promise<Result> {
  const user = await requireDirector();
  const existing = await db.service.findFirst({ where: { id: serviceId, organizationId: user.organizationId } });
  if (!existing) return { ok: false, error: "Serviço não encontrado." };
  await db.service.update({ where: { id: serviceId }, data: { active: !existing.active } });
  done();
  return { ok: true };
}

export async function deleteServiceAction(serviceId: string): Promise<Result> {
  const user = await requireDirector();
  const existing = await db.service.findFirst({ where: { id: serviceId, organizationId: user.organizationId } });
  if (!existing) return { ok: false, error: "Serviço não encontrado." };
  await db.service.delete({ where: { id: serviceId } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "SERVICE_DELETED", entityType: "Service", entityId: serviceId, metadata: { name: existing.name } });
  done();
  return { ok: true };
}

export async function setClientServicesAction(clientId: string, serviceIds: string[]): Promise<Result> {
  const user = await requirePermission(permKey("CLIENTS", "EDIT"));
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId } });
  if (!client) return { ok: false, error: "Cliente não encontrado." };
  const valid = await db.service.findMany({ where: { organizationId: user.organizationId, id: { in: serviceIds } }, select: { id: true } });

  await db.$transaction([
    db.clientService.deleteMany({ where: { clientId } }),
    db.clientService.createMany({ data: valid.map((s) => ({ clientId, serviceId: s.id })) }),
  ]);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

// Cria ou atualiza os serviços do Guia Comercial pelo guideKey. Preço e
// textos voltam ao que está no Guia; serviços criados à mão não são tocados.
export async function loadGuideCatalogAction(): Promise<{ ok: true; created: number; updated: number } | { ok: false; error: string }> {
  const user = await requireDirector();
  const existing = await db.service.findMany({
    where: { organizationId: user.organizationId, guideKey: { not: null } },
    select: { guideKey: true },
  });
  const known = new Set(existing.map((e) => e.guideKey));
  let created = 0;
  let updated = 0;

  for (const [index, g] of GUIDE_CATALOG.entries()) {
    const data = {
      name: g.name,
      category: g.category,
      description: g.description ?? null,
      defaultPrice: g.price,
      billing: g.billing,
      currency: g.currency ?? "BRL",
      tagline: g.tagline ?? null,
      features: g.features,
      badge: g.badge ?? null,
      priceIsFrom: g.priceIsFrom ?? false,
      monthlyFee: g.monthlyFee ?? null,
      cardMode: g.cardMode ?? "AUTO",
      cardPrice: g.cardPrice ?? null,
      maxInstallments: g.maxInstallments ?? null,
      minMonths: g.minMonths ?? null,
      isAddon: g.isAddon ?? false,
      terms: g.terms ?? null,
      position: index,
    };
    await db.service.upsert({
      where: { organizationId_guideKey: { organizationId: user.organizationId, guideKey: g.guideKey } },
      create: { organizationId: user.organizationId, guideKey: g.guideKey, ...data },
      update: data,
    });
    if (known.has(g.guideKey)) updated++;
    else created++;
  }

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SERVICE_GUIDE_LOADED",
    entityType: "Service",
    metadata: { created, updated },
  });
  done();
  return { ok: true, created, updated };
}
