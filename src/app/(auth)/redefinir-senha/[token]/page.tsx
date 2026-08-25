import crypto from "node:crypto";
import { db } from "@/lib/db";
import { ResetPasswordForm } from "./reset-password-form";

// Branding do "voltar" pós-redefinição: convites do Mídia ADESF devem
// devolver o usuário ao login do portal (/midia/login), não ao /login do
// LUMIBASE — sem isso um voluntário de mídia puro cairia numa tela que
// não reconhece as credenciais dele para nada além do próprio portal.
async function resolveIsMediaOnlyToken(token: string): Promise<boolean> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const resetToken = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
          mediaMember: { select: { id: true } },
        },
      },
    },
  });
  if (!resetToken) return false;
  const hasDashboardAccess = resetToken.user.role.permissions.some((rp) => rp.permission.key === "DASHBOARD_VIEW");
  return !!resetToken.user.mediaMember && !hasDashboardAccess;
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const isMediaOnly = await resolveIsMediaOnlyToken(token);
  return <ResetPasswordForm token={token} loginHref={isMediaOnly ? "/midia/login" : "/login"} />;
}
