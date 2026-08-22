import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function FinancePage() {
  await requirePermission(permKey("FINANCE", "VIEW"));
  return (
    <ModulePlaceholder
      title="Visão Financeira"
      description="Saldo, receitas, despesas, margem e indicadores financeiros consolidados."
    />
  );
}
