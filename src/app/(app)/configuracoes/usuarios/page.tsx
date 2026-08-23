import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { UsersView } from "./users-view";

export default async function UsersPage() {
  const user = await requirePermission(permKey("USERS", "VIEW"));

  const [users, roles] = await Promise.all([
    db.user.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { role: { select: { id: true, name: true } } },
    }),
    db.role.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      include: { permissions: { select: { permission: { select: { key: true } } } }, _count: { select: { users: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Usuários" description="Gestão de usuários, perfis e permissões granulares (RBAC)." />
      <UsersView
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          roleId: u.role.id,
          roleName: u.role.name,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        }))}
        roles={roles.map((r) => ({
          id: r.id,
          name: r.name,
          isSystem: r.isSystem,
          userCount: r._count.users,
          permissionKeys: r.permissions.map((p) => p.permission.key),
        }))}
        currentUserId={user.id}
      />
    </div>
  );
}
