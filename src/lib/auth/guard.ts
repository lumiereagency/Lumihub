import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
    // Sessão vencida: volta ao login do portal já com a página que a pessoa queria abrir.
    const wanted = (await headers()).get("x-lb-path");
    const next = wanted && wanted.startsWith("/midia/") && !wanted.startsWith("/midia/login") ? `?next=${encodeURIComponent(wanted)}` : "";
    redirect(`/midia/login${next}`);
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

// Diretoria = dono da conta ou perfil ADMIN. Preço de tabela, descontos,
// catálogo de serviços e taxas da maquininha são decisão só dela (§ Guia
// Comercial: "condição diferente precisa de aprovação da diretoria") — o
// perfil Comercial tem CRM "gerenciar", então essa permissão não basta.
export function isDirector(user: CurrentUser): boolean {
  return user.isOwner || user.role.key === "ADMIN";
}

export async function requireDirector(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isDirector(user)) redirect("/acesso-negado");
  return user;
}
