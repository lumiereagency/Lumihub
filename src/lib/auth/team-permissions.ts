import "server-only";
import { db } from "@/lib/db";
import { effectivePermissions } from "@/lib/auth/access";

// Permissões efetivas de cada pessoa ativa da organização (perfil principal,
// perfis adicionais e ajustes aba por aba) — para rotinas que escolhem quem
// recebe um aviso sem ter a sessão da pessoa em mãos.
export async function loadTeamPermissions(organizationId: string) {
  const [users, roles] = await Promise.all([
    db.user.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true, isOwner: true, roleId: true, extraRoleIds: true, moduleAccess: true, notificationSettings: true, role: { select: { key: true } } },
    }),
    db.role.findMany({ where: { organizationId }, select: { id: true, key: true, permissions: { select: { permission: { select: { key: true } } } } } }),
  ]);
  const permsOf = new Map(roles.map((r) => [r.id, r.permissions.map((p) => p.permission.key)]));
  const nonAdmin = new Set(roles.filter((r) => r.key !== "ADMIN").map((r) => r.id));
  return users.map((u) => ({
    ...u,
    director: u.isOwner || u.role.key === "ADMIN",
    permissions: effectivePermissions({
      rolePermissions: permsOf.get(u.roleId) ?? [],
      extraRolePermissions: u.extraRoleIds.filter((id) => nonAdmin.has(id)).map((id) => permsOf.get(id) ?? []),
      moduleAccess: u.moduleAccess,
    }),
  }));
}

// Recebe só quem tem a permissão (diretoria sempre recebe).
export async function usersWithPermission(organizationId: string, key: string): Promise<string[]> {
  const team = await loadTeamPermissions(organizationId);
  return team.filter((u) => u.director || u.permissions.has(key)).map((u) => u.id);
}
