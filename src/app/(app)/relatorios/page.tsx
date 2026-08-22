import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function ReportsPage() {
  await requirePermission(permKey("REPORTS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Relatórios"
      description="Relatórios financeiros, comerciais, de clientes, projetos, equipe e margem, com exportação."
    />
  );
}
