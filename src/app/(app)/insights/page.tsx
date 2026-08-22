import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function InsightsPage() {
  await requirePermission(permKey("AI", "VIEW"));
  return <ModulePlaceholder title="Insights" description="Riscos, oportunidades e recomendações geradas a partir dos dados reais." />;
}
