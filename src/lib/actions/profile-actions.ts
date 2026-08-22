"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeSession, revokeAllOtherSessions } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { changePasswordSchema } from "@/lib/validation/auth";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const validCurrent = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);
  if (!validCurrent) {
    return { error: "Senha atual incorreta." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  await revokeAllOtherSessions(user.id, user.sessionId);
  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
  });

  revalidatePath("/configuracoes/perfil");
  return { success: "Senha alterada com sucesso. Outras sessões ativas foram encerradas." };
}

export async function revokeSessionAction(sessionId: string) {
  const user = await requireUser();
  await revokeSession(sessionId, user.id);
  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SESSION_REVOKED",
    entityType: "Session",
    entityId: sessionId,
  });
  revalidatePath("/configuracoes/perfil");
}
