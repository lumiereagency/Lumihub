import { db } from "@/lib/db";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import type { RoleKey } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type DbClient = typeof db | Prisma.TransactionClient;

// Garante que o catálogo global de permissões existe no banco (idempotente).
export async function ensurePermissionCatalog(client: DbClient = db) {
  for (const p of ALL_PERMISSIONS) {
    await client.permission.upsert({
      where: { key: p.key },
      create: p,
      update: { module: p.module, action: p.action, description: p.description },
    });
  }
}

// Cria os perfis padrão (ADMIN, FINANCEIRO, OPERACAO, COMERCIAL, GESTAO) para
// uma organização com as permissões granulares definidas em DEFAULT_ROLE_PERMISSIONS.
// Recebe opcionalmente o client de uma transação em andamento (necessário porque
// o client global não enxerga linhas ainda não commitadas por outra transação).
export async function ensureDefaultRoles(organizationId: string, client: DbClient = db) {
  await ensurePermissionCatalog(client);
  const roleKeys = Object.keys(DEFAULT_ROLE_PERMISSIONS) as Exclude<RoleKey, "CUSTOM" | "MEDIA_ONLY">[];

  for (const key of roleKeys) {
    const role = await client.role.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, name: ROLE_LABELS[key], isSystem: true },
      update: {},
    });

    const permissionKeys = DEFAULT_ROLE_PERMISSIONS[key];
    const permissions = await client.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });

    await client.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length > 0) {
      await client.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }
}

interface CreateOrgInput {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  timezone: string;
  currency: string;
}

// Fluxo de Primeiro Acesso (Fase 1.3): cria a organização, os perfis padrão
// e o usuário ADMIN inicial.
export async function createOrganizationWithAdmin(input: CreateOrgInput) {
  const slug = slugify(input.companyName);
  const passwordHash = await hashPassword(input.adminPassword);

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.companyName,
        slug,
        timezone: input.timezone,
        currency: input.currency,
      },
    });

    await ensureDefaultRoles(organization.id, tx);

    const adminRole = await tx.role.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: organization.id, key: "ADMIN" } },
    });

    const user = await tx.user.create({
      data: {
        organizationId: organization.id,
        roleId: adminRole.id,
        name: input.adminName,
        email: input.adminEmail.toLowerCase().trim(),
        passwordHash,
        emailVerifiedAt: new Date(),
        isOwner: true,
      },
    });

    return { organization, user };
  });
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "org"}-${suffix}`;
}

export async function hasAnyOrganization(): Promise<boolean> {
  const count = await db.organization.count();
  return count > 0;
}
