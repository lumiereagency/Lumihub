"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import type { AlertStatus } from "@/generated/prisma/enums";

async function updateAlertStatus(alertId: string, status: Extract<AlertStatus, "RESOLVIDO" | "DISPENSADO">): Promise<void> {
  const user = await requirePermission(permKey("ALERTS", "VIEW"));

  const alert = await db.alert.findFirst({ where: { id: alertId, organizationId: user.organizationId } });
  if (!alert || alert.status !== "ABERTO") return;

  await db.alert.update({ where: { id: alertId }, data: { status, resolvedAt: new Date() } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: status === "RESOLVIDO" ? "ALERT_RESOLVED" : "ALERT_DISMISSED",
    entityType: "Alert",
    entityId: alertId,
  });

  revalidatePath("/alertas");
}

export async function resolveAlertAction(alertId: string): Promise<void> {
  await updateAlertStatus(alertId, "RESOLVIDO");
}

export async function dismissAlertAction(alertId: string): Promise<void> {
  await updateAlertStatus(alertId, "DISPENSADO");
}
