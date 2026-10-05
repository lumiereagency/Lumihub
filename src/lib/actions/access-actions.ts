"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireUser, hasPermission } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { MODULE_LABELS, type Module } from "@/lib/auth/permissions";
import { ACCESS_MANAGE_ALL, ACCESS_MANAGE_OPERATIONAL, ACCESS_TABS, OPERATIONAL_MODULES, effectivePermissions, levelOf, parseModuleAccess, type ModuleAccess } from "@/lib/auth/access";
import { notifyUsers } from "@/lib/notifications/notify";

const TAB_MODULES = ACCESS_TABS.map((t) => t.module) as [Module, ...Module[]];

const schema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1).optional(),
  extraRoleIds: z.array(z.string().min(1)).max(10).optional(),
  // null = volta ao que o perfil define
  moduleAccess: z.record(z.enum(TAB_MODULES), z.enum(["off", "view", "full"]).nullable()),
});

async function permissionsFor(organizationId: string, roleId: string, extraRoleIds: string[], moduleAccess: ModuleAccess) {
  const roles = await db.role.findMany({
    where: { organizationId, id: { in: [roleId, ...extraRoleIds] } },
    select: { id: true, permissions: { select: { permission: { select: { key: true } } } } },
  });
  const keys = (id: string) => roles.find((r) => r.id === id)?.permissions.map((p) => p.permission.key) ?? [];
  return effectivePermissions({ rolePermissions: keys(roleId), extraRolePermissions: extraRoleIds.map(keys), moduleAccess });
}

const TAB_LABEL = new Map(ACCESS_TABS.map((t) => [t.module, t.label]));

export async function updateUserAccessAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireUser();
  const all = hasPermission(actor, ACCESS_MANAGE_ALL);
  const operational = hasPermission(actor, ACCESS_MANAGE_OPERATIONAL);
  if (!all && !operational) return { ok: false, error: "Você não pode mudar acessos." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira as opções." };
  const data = parsed.data;

  const target = await db.user.findFirst({
    where: { id: data.userId, organizationId: actor.organizationId, deletedAt: null },
    include: { role: { select: { key: true } } },
  });
  if (!target) return { ok: false, error: "Pessoa não encontrada." };
  if (target.isOwner || target.role.key === "ADMIN") return { ok: false, error: "Administradores já têm acesso a tudo." };
  if (!all && target.id === actor.id) return { ok: false, error: "Peça à diretoria para mudar o seu próprio acesso." };

  // Gestão operacional só mexe nas abas da operação; o resto fica como está.
  const before = parseModuleAccess(target.moduleAccess);
  const next: ModuleAccess = { ...before };
  for (const [module, level] of Object.entries(data.moduleAccess) as [Module, ModuleAccess[Module] | null][]) {
    if (!all && !OPERATIONAL_MODULES.includes(module)) continue;
    if (level) next[module] = level;
    else delete next[module];
  }

  let roleId = target.roleId;
  let extraRoleIds = target.extraRoleIds;
  if (all && (data.roleId || data.extraRoleIds)) {
    const roles = await db.role.findMany({ where: { organizationId: actor.organizationId }, select: { id: true, key: true } });
    const byId = new Map(roles.map((r) => [r.id, r.key]));
    if (data.roleId) {
      const key = byId.get(data.roleId);
      if (!key) return { ok: false, error: "Perfil inválido." };
      if (key === "ADMIN") return { ok: false, error: "Para tornar alguém administrador, use Configurações → Usuários." };
      roleId = data.roleId;
    }
    if (data.extraRoleIds) {
      extraRoleIds = [...new Set(data.extraRoleIds)].filter((id) => {
        const key = byId.get(id);
        return key && key !== "ADMIN" && key !== "MEDIA_ONLY" && id !== roleId;
      });
    }
  }

  await db.user.update({
    where: { id: target.id },
    data: { roleId, extraRoleIds, moduleAccess: Object.keys(next).length ? (next as object) : Prisma.DbNull },
  });

  // Avisa a pessoa das abas que acabaram de abrir para ela.
  const [prevPerms, newPerms] = await Promise.all([
    permissionsFor(actor.organizationId, target.roleId, target.extraRoleIds, before),
    permissionsFor(actor.organizationId, roleId, extraRoleIds, next),
  ]);
  const opened = ACCESS_TABS.filter((t) => levelOf(prevPerms, t.module) === "off" && levelOf(newPerms, t.module) !== "off").map((t) => t.label);
  if (opened.length > 0) {
    await notifyUsers({
      organizationId: actor.organizationId,
      userIds: [target.id],
      title: opened.length === 1 ? `Você agora tem acesso a ${opened[0]}` : "Você ganhou acesso a novas abas",
      body: `${actor.name.split(" ")[0]} liberou: ${opened.join(", ")}.`,
      link: "/dashboard",
      category: "operacao",
    });
  }

  await audit({
    organizationId: actor.organizationId,
    userId: actor.id,
    action: "USER_ACCESS_UPDATED",
    entityType: "User",
    entityId: target.id,
    metadata: {
      roleId,
      extraRoleIds,
      moduleAccess: Object.fromEntries(Object.entries(next).map(([m, l]) => [TAB_LABEL.get(m as Module) ?? MODULE_LABELS[m as Module], l])),
    },
  });

  revalidatePath("/equipe/acessos");
  revalidatePath("/configuracoes/usuarios");
  return { ok: true };
}
