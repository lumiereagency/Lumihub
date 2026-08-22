import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function TeamPage() {
  await requirePermission(permKey("TEAM", "VIEW"));
  return (
    <ModulePlaceholder
      title="Funcionários"
      description="Funcionários, freelancers e prestadores, com custo por projeto."
    />
  );
}
