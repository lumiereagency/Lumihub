import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { MEDIA_PORTAL_ACCESS, MEDIA_PORTAL_TEAM_VIEW } from "@/lib/auth/permissions";

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

// Guarda de acesso ao Portal Mídia ADESF (/midia/*) — completamente separada
// de requireUser()/requirePermission() porque o portal não é gated pelo
// catálogo de Role/RolePermission do LUMIBASE, e sim pelo vínculo aditivo
// MediaMember (ver session.ts). Redireciona para o login white-label do
// portal, nunca para /login ou /acesso-negado do LUMIBASE.
export async function requireMediaMember(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, MEDIA_PORTAL_ACCESS)) {
    redirect("/midia/login");
  }
  return user;
}

export function isMediaLeader(user: CurrentUser): boolean {
  return hasPermission(user, MEDIA_PORTAL_TEAM_VIEW);
}

export function hasPermission(user: CurrentUser, permission: string): boolean {
  return user.permissions.has(permission);
}

// Use em Server Components/Actions para exigir uma permissão granular.
// Redireciona para /acesso-negado em vez de vazar a existência do recurso.
export async function requirePermission(permission: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) {
    redirect("/acesso-negado");
  }
  return user;
}
