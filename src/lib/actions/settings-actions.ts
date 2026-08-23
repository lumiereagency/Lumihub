"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { organizationSettingsSchema } from "@/lib/validation/settings";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function updateOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("SETTINGS", "EDIT"));

  const parsed = organizationSettingsSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  await db.organization.update({
    where: { id: user.organizationId },
    data: parsed.data,
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "ORGANIZATION_SETTINGS_UPDATED",
    entityType: "Organization",
    entityId: user.organizationId,
    metadata: parsed.data,
  });

  revalidatePath("/configuracoes");
  return { success: "Preferências atualizadas." };
}
