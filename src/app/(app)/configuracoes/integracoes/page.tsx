import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function IntegrationsPage() {
  await requirePermission(permKey("INTEGRATIONS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Integrações"
      description="Calendário, comunicação, financeiro, IA, armazenamento e automação. LUMIHUB Vault para credenciais."
    />
  );
}
