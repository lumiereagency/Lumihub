// Atualiza só o perfil "Gestão" para "Gestão operacional" (permissões novas),
// sem mexer nos outros perfis. Uso: npx tsx scripts/setup-gestao-operacional.ts
import { db } from "@/lib/db";
import { DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS, ALL_PERMISSIONS } from "@/lib/auth/permissions";

async function main() {
  for (const p of ALL_PERMISSIONS) {
    await db.permission.upsert({ where: { key: p.key }, create: p, update: {} });
  }
  const orgs = await db.organization.findMany({ select: { id: true } });
  for (const org of orgs) {
    const role = await db.role.upsert({
      where: { organizationId_key: { organizationId: org.id, key: "GESTAO" } },
      create: { organizationId: org.id, key: "GESTAO", name: ROLE_LABELS.GESTAO, isSystem: true },
      update: { name: ROLE_LABELS.GESTAO },
    });
    const perms = await db.permission.findMany({ where: { key: { in: DEFAULT_ROLE_PERMISSIONS.GESTAO } }, select: { id: true } });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })), skipDuplicates: true });
    const users = await db.user.findMany({ where: { roleId: role.id }, select: { name: true } });
    console.log(`Gestão operacional atualizado (${perms.length} permissões). Pessoas neste perfil: ${users.map((u) => u.name).join(", ") || "nenhuma"}`);
  }
}

main().then(() => process.exit(0));
