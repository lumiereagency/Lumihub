import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function ContractsPage() {
  await requirePermission(permKey("CONTRACTS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Contratos"
      description="Biblioteca de modelos e contratos gerados a partir dos dados cadastrados."
    />
  );
}
