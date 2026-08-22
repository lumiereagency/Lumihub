import { redirect } from "next/navigation";
import { hasAnyOrganization } from "@/lib/auth/bootstrap";
import { getCurrentUser } from "@/lib/auth/session";

// Depende do estado atual do banco (organização/sessão) — nunca pode ser
// pré-renderizada estaticamente em build time.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const hasOrg = await hasAnyOrganization();
  if (!hasOrg) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  redirect("/dashboard");
}
