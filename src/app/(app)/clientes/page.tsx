import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function ClientsPage() {
  await requirePermission(permKey("CLIENTS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Clientes"
      description="Cadastro central de clientes: contratos, projetos, financeiro, agenda e histórico."
    />
  );
}
