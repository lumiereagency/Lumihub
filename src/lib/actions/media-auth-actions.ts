"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, getRequestMeta } from "@/lib/auth/session";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/audit";
import { loginSchema } from "@/lib/validation/auth";
import type { ActionState } from "@/lib/actions/auth-actions";

const GENERIC_ERROR = "E-mail ou senha inválidos, ou esta conta não tem acesso ao Mídia ADESF.";

// Login white-label do Portal Mídia ADESF — mesma verificação de senha e
// mesmo mecanismo de sessão do LUMIBASE (nenhuma autenticação paralela),
// mas só autentica quem tem um vínculo MediaMember ACTIVE. Mantido separado
// de loginAction() porque a mensagem de erro e o redirecionamento são
// diferentes, e para não misturar as duas telas de login no mesmo formulário.
export async function loginMediaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { email, password, remember } = parsed.data;
  const { ip } = await getRequestMeta();
  const ipKey = ip ?? "unknown";

  const rateLimit = await isLoginRateLimited(email, ipKey);
  if (rateLimit.limited) {
    return { error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente." };
  }

  const user = await db.user.findFirst({
    where: { email, deletedAt: null },
    include: { mediaMember: true },
  });

  if (!user || !user.isActive || !user.mediaMember || user.mediaMember.status !== "ACTIVE") {
    await recordLoginAttempt(email, ipKey, false);
    return { error: GENERIC_ERROR };
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    await recordLoginAttempt(email, ipKey, false);
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "MEDIA_LOGIN_FAILED",
      entityType: "MediaMember",
      entityId: user.mediaMember.id,
    });
    return { error: GENERIC_ERROR };
  }

  await recordLoginAttempt(email, ipKey, true);
  await createSession(user.id, remember);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_LOGIN",
    entityType: "MediaMember",
    entityId: user.mediaMember.id,
  });

  redirect("/midia/inicio");
}
