"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createOrganizationWithAdmin } from "@/lib/auth/bootstrap";
import { getCurrentUser, createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { setupOrganizationSchema } from "@/lib/validation/auth";
import type { ActionState } from "@/lib/actions/auth-actions";

// Criar uma organização não exige que seja a primeira da implantação (Fase
// 45 — Multi-organização): qualquer visitante sem sessão ativa pode cadastrar
// uma nova empresa isolada a qualquer momento. Só bloqueia quem já está
// logado, para não criar uma segunda organização por engano a partir de uma
// sessão existente.
export async function setupOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (await getCurrentUser()) {
    redirect("/dashboard");
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

  const existing = await db.user.findFirst({ where: { email: parsed.data.adminEmail } });
  if (existing) {
    return { error: "Já existe uma conta com este e-mail. Faça login ou use outro e-mail." };
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
