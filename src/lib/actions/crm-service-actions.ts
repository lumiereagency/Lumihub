"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; error: string };

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao serviço.").max(120),
  category: z.string().trim().max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  defaultPrice: z.number().nonnegative("O preço não pode ser negativo.").max(100_000_000).nullable().optional(),
});

function done() {
  revalidatePath("/crm");
  revalidatePath("/crm/servicos");
  revalidatePath("/clientes", "layout");
}

export async function saveServiceAction(serviceId: string | null, input: z.input<typeof serviceSchema>): Promise<Result> {
  const user = await requirePermission(permKey("CRM", "MANAGE"));
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = {
    name: parsed.data.name,
    category: parsed.data.category || null,
    description: parsed.data.description || null,
    defaultPrice: parsed.data.defaultPrice ?? null,
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
  const user = await requirePermission(permKey("CRM", "MANAGE"));
  const existing = await db.service.findFirst({ where: { id: serviceId, organizationId: user.organizationId } });
  if (!existing) return { ok: false, error: "Serviço não encontrado." };
  await db.service.update({ where: { id: serviceId }, data: { active: !existing.active } });
  done();
  return { ok: true };
}

export async function deleteServiceAction(serviceId: string): Promise<Result> {
  const user = await requirePermission(permKey("CRM", "MANAGE"));
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
