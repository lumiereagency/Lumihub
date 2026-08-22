import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function PayablesPage() {
  await requirePermission(permKey("PAYABLES", "VIEW"));
  return (
    <ModulePlaceholder
      title="Contas a Pagar"
      description="Despesas, recorrências, parcelamentos e centros de custo."
    />
  );
}
