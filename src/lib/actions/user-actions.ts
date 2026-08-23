"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/integrations/email";
import { userSchema, updateUserSchema, roleSchema, updateRolePermissionsSchema } from "@/lib/validation/users";
import type { ActionState } from "@/lib/actions/auth-actions";

async function sendInviteEmail(organizationId: string, name: string, email: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await db.user.findFirstOrThrow({ where: { organizationId, email } });

  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });

  const inviteUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/redefinir-senha/${token}`;
  const result = await sendEmail({
    organizationId,
    to: email,
    subject: "Bem-vindo(a) ao LUMIBASE — defina sua senha",
    text: `Olá, ${name}. Sua conta no LUMIBASE foi criada. Defina sua senha de acesso (link válido por 7 dias): ${inviteUrl}`,
  });
  return result;
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission(permKey("USERS", "CREATE"));

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const role = await db.role.findFirst({ where: { id: parsed.data.roleId, organizationId: admin.organizationId } });
  if (!role) return { error: "Perfil inválido." };

  const existing = await db.user.findFirst({ where: { email: parsed.data.email } });
  if (existing) return { error: "Já existe uma conta com este e-mail no sistema." };

  const randomPassword = crypto.randomBytes(24).toString("hex");
  const user = await db.user.create({
    data: {
      organizationId: admin.organizationId,
      name: parsed.data.name,
      email: parsed.data.email,
      roleId: role.id,
      passwordHash: await hashPassword(randomPassword),
    },
  });

  const inviteResult = await sendInviteEmail(admin.organizationId, user.name, user.email);

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, role: role.key },
  });

  revalidatePath("/configuracoes/usuarios");

  if (inviteResult.pending) {
    return { success: "Usuário criado. Nenhum provedor de e-mail conectado — envie o link de acesso manualmente ou reenvie o convite após conectar um provedor em Integrações." };
  }
  return { success: "Usuário criado e convite enviado por e-mail." };
}

export async function updateUserAction(userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission(permKey("USERS", "EDIT"));

  const parsed = updateUserSchema.safeParse({
    name: formData.get("name"),
    roleId: formData.get("roleId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const user = await db.user.findFirst({ where: { id: userId, organizationId: admin.organizationId, deletedAt: null }, include: { role: true } });
  if (!user) return { error: "Usuário não encontrado." };

  const role = await db.role.findFirst({ where: { id: parsed.data.roleId, organizationId: admin.organizationId } });
  if (!role) return { error: "Perfil inválido." };

  const losesAdmin = user.role.key === "ADMIN" && (role.key !== "ADMIN" || !parsed.data.isActive);
  if (losesAdmin) {
    const otherActiveAdmins = await db.user.count({
      where: { organizationId: admin.organizationId, deletedAt: null, isActive: true, id: { not: userId }, role: { key: "ADMIN" } },
    });
    if (otherActiveAdmins === 0) {
      return { error: "Não é possível remover o último administrador ativo da organização." };
    }
  }

  await db.user.update({
    where: { id: userId },
    data: { name: parsed.data.name, roleId: role.id, isActive: parsed.data.isActive },
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: userId,
    metadata: { role: role.key, isActive: parsed.data.isActive },
  });

  revalidatePath("/configuracoes/usuarios");
  return { success: "Usuário atualizado." };
}

export async function resendInviteAction(userId: string): Promise<void> {
  const admin = await requirePermission(permKey("USERS", "EDIT"));

  const user = await db.user.findFirst({ where: { id: userId, organizationId: admin.organizationId, deletedAt: null } });
  if (!user) return;

  await sendInviteEmail(admin.organizationId, user.name, user.email);

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "USER_INVITE_RESENT",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/configuracoes/usuarios");
}

export async function deleteUserAction(userId: string): Promise<void> {
  const admin = await requirePermission(permKey("USERS", "DELETE"));

  const user = await db.user.findFirst({ where: { id: userId, organizationId: admin.organizationId, deletedAt: null }, include: { role: true } });
  if (!user) return;

  if (user.role.key === "ADMIN") {
    const otherActiveAdmins = await db.user.count({
      where: { organizationId: admin.organizationId, deletedAt: null, isActive: true, id: { not: userId }, role: { key: "ADMIN" } },
    });
    if (otherActiveAdmins === 0) return;
  }

  await db.$transaction([
    db.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } }),
    db.user.update({ where: { id: userId }, data: { deletedAt: new Date(), isActive: false } }),
  ]);

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "USER_DELETED",
    entityType: "User",
    entityId: userId,
    metadata: { email: user.email },
  });

  revalidatePath("/configuracoes/usuarios");
}

export async function createRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission(permKey("USERS", "MANAGE"));

  const parsed = roleSchema.safeParse({
    name: formData.get("name"),
    permissionKeys: formData.getAll("permissionKeys"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const permissions = await db.permission.findMany({ where: { key: { in: parsed.data.permissionKeys } }, select: { id: true } });

  const role = await db.role.create({
    data: { organizationId: admin.organizationId, key: "CUSTOM", name: parsed.data.name, isSystem: false },
  });
  if (permissions.length > 0) {
    await db.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "ROLE_CREATED",
    entityType: "Role",
    entityId: role.id,
    metadata: { name: role.name },
  });

  revalidatePath("/configuracoes/usuarios");
  return { success: "Perfil criado." };
}

export async function updateRolePermissionsAction(roleId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission(permKey("USERS", "MANAGE"));

  const parsed = updateRolePermissionsSchema.safeParse({ permissionKeys: formData.getAll("permissionKeys") });
  if (!parsed.success) return { error: "Verifique as permissões selecionadas." };

  const role = await db.role.findFirst({ where: { id: roleId, organizationId: admin.organizationId } });
  if (!role) return { error: "Perfil não encontrado." };
  if (role.isSystem) return { error: "Perfis padrão do sistema não podem ter suas permissões editadas." };

  const permissions = await db.permission.findMany({ where: { key: { in: parsed.data.permissionKeys } }, select: { id: true } });

  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    ...(permissions.length > 0
      ? [db.rolePermission.createMany({ data: permissions.map((p) => ({ roleId, permissionId: p.id })) })]
      : []),
  ]);

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "ROLE_PERMISSIONS_UPDATED",
    entityType: "Role",
    entityId: roleId,
  });

  revalidatePath("/configuracoes/usuarios");
  return { success: "Permissões atualizadas." };
}

export async function deleteRoleAction(roleId: string): Promise<void> {
  const admin = await requirePermission(permKey("USERS", "MANAGE"));

  const role = await db.role.findFirst({ where: { id: roleId, organizationId: admin.organizationId }, include: { _count: { select: { users: true } } } });
  if (!role || role.isSystem || role._count.users > 0) return;

  await db.role.delete({ where: { id: roleId } });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "ROLE_DELETED",
    entityType: "Role",
    entityId: roleId,
    metadata: { name: role.name },
  });

  revalidatePath("/configuracoes/usuarios");
}
