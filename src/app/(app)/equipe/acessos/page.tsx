import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { ACCESS_MANAGE_ALL, ACCESS_MANAGE_OPERATIONAL, ACCESS_TABS, OPERATIONAL_MODULES, effectivePermissions, levelOf, parseModuleAccess } from "@/lib/auth/access";
import { PageHeader } from "@/components/layout/page-header";
import { AccessBoard, type AccessPerson } from "./access-board";

export default async function AccessPage() {
  const user = await requireUser();
  const all = hasPermission(user, ACCESS_MANAGE_ALL);
  if (!all && !hasPermission(user, ACCESS_MANAGE_OPERATIONAL)) redirect("/acesso-negado");

  const [users, roles] = await Promise.all([
    db.user.findMany({
      where: { organizationId: user.organizationId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, isOwner: true, roleId: true, extraRoleIds: true, moduleAccess: true, role: { select: { key: true, name: true } } },
    }),
    db.role.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } },
    }),
  ]);
  const permsOf = new Map(roles.map((r) => [r.id, r.permissions.map((p) => p.permission.key)]));

  const people: AccessPerson[] = users
    .filter((u) => all || u.id !== user.id)
    .map((u) => {
      const director = u.isOwner || u.role.key === "ADMIN";
      const extra = u.extraRoleIds.filter((id) => permsOf.has(id) && roles.find((r) => r.id === id)?.key !== "ADMIN");
      const base = effectivePermissions({ rolePermissions: permsOf.get(u.roleId) ?? [], extraRolePermissions: extra.map((id) => permsOf.get(id) ?? []), moduleAccess: null });
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        director,
        roleId: u.roleId,
        roleName: u.role.name,
        extraRoleIds: extra,
        overrides: parseModuleAccess(u.moduleAccess),
        // O que os perfis dão, antes dos ajustes — a tela calcula o resultado.
        fromRoles: Object.fromEntries(ACCESS_TABS.map((t) => [t.module, director ? "full" : levelOf(base, t.module)])),
      };
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Acessos"
        description={
          all
            ? "Escolha o que cada pessoa vê. Some perfis (ex.: comercial + social media) e libere ou feche aba por aba."
            : "Libere ou feche as abas da operação (Workspace, Projetos, Captações, Agenda e Documentos) para cada pessoa."
        }
      />
      <AccessBoard
        people={people}
        roles={roles.filter((r) => r.key !== "ADMIN").map((r) => ({ id: r.id, key: r.key, name: r.name, permissions: r.permissions.map((p) => p.permission.key) }))}
        scope={all ? "all" : "operational"}
        editableModules={all ? ACCESS_TABS.map((t) => t.module) : OPERATIONAL_MODULES}
      />
    </div>
  );
}
