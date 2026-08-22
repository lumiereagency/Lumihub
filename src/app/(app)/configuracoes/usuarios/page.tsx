import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function UsersPage() {
  await requirePermission(permKey("USERS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Usuários"
      description="Gestão de usuários, perfis e permissões granulares (RBAC)."
    />
  );
}
