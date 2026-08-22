"use server";

import { redirect } from "next/navigation";
import { createOrganizationWithAdmin, hasAnyOrganization } from "@/lib/auth/bootstrap";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { setupOrganizationSchema } from "@/lib/validation/auth";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function setupOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (await hasAnyOrganization()) {
    return { error: "O LUMIHUB já foi configurado. Acesse a tela de login." };
  }

  const parsed = setupOrganizationSchema.safeParse({
    companyName: formData.get("companyName"),
    adminName: formData.get("adminName"),
    adminEmail: formData.get("adminEmail"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const { organization, user } = await createOrganizationWithAdmin({
    companyName: parsed.data.companyName,
    adminName: parsed.data.adminName,
    adminEmail: parsed.data.adminEmail,
    adminPassword: parsed.data.password,
    timezone: parsed.data.timezone,
    currency: parsed.data.currency,
  });

  await createSession(user.id, true);
  await audit({
    organizationId: organization.id,
    userId: user.id,
    action: "SETUP_COMPLETED",
    entityType: "Organization",
    entityId: organization.id,
  });

  redirect("/dashboard");
}
