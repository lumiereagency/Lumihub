import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function AlertsPage() {
  await requirePermission(permKey("ALERTS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Central de Alertas"
      description="Alertas financeiros, comerciais, operacionais, de clientes, contratos e equipe."
    />
  );
}
