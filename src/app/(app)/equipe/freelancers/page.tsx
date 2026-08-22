import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function FreelancersPage() {
  await requirePermission(permKey("TEAM", "VIEW"));
  return <ModulePlaceholder title="Freelancers" description="Cadastro de freelancers e prestadores parceiros." />;
}
