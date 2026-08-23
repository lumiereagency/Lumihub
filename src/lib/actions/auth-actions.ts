"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession, getRequestMeta, getCurrentUser } from "@/lib/auth/session";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/integrations/email";
import {
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type ActionState = { error?: string; success?: string };

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";
const GENERIC_RESET_MESSAGE =
  "Se este e-mail estiver cadastrado, você receberá instruções em instantes.";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_LOGIN_ERROR };
  }

  const { email, password, remember } = parsed.data;
  const { ip } = await getRequestMeta();
  const ipKey = ip ?? "unknown";

  const rateLimit = await isLoginRateLimited(email, ipKey);
  if (rateLimit.limited) {
    return {
      error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
    };
  }

  const user = await db.user.findFirst({ where: { email, deletedAt: null } });

  if (!user || !user.isActive) {
    await recordLoginAttempt(email, ipKey, false);
    return { error: GENERIC_LOGIN_ERROR };
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    await recordLoginAttempt(email, ipKey, false);
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user.id,
    });
    return { error: GENERIC_LOGIN_ERROR };
  }

  await recordLoginAttempt(email, ipKey, true);
  await createSession(user.id, remember);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "LOGOUT",
      entityType: "User",
      entityId: user.id,
    });
  }
  await destroyCurrentSession();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    // Mesmo erro de validação simples não revela existência de conta.
    return { success: GENERIC_RESET_MESSAGE };
  }

  const { email } = parsed.data;
  const user = await db.user.findFirst({ where: { email, deletedAt: null, isActive: true } });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user.id,
    });

    const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/redefinir-senha/${token}`;
    await sendEmail({
      organizationId: user.organizationId,
      to: user.email,
      subject: "LUMIHUB — Redefinição de senha",
      text: `Olá, ${user.name}. Use o link a seguir para redefinir sua senha (válido por 1 hora): ${resetUrl}`,
    });
  }

  // Mensagem idêntica independentemente de o e-mail existir ou não.
  return { success: GENERIC_RESET_MESSAGE };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Não foi possível redefinir a senha." };
  }

  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { error: "Este link de redefinição é inválido ou expirou. Solicite um novo." };
  }

  const passwordHash = await hashPassword(password);

  await db.$transaction([
    db.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    db.session.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit({
    organizationId: resetToken.user.organizationId,
    userId: resetToken.userId,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: resetToken.userId,
  });

  return { success: "Senha redefinida com sucesso. Faça login com sua nova senha." };
}
