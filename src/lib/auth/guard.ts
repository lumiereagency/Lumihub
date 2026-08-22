import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
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
