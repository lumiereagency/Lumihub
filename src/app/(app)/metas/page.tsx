import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function GoalsPage() {
  await requirePermission(permKey("GOALS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Metas"
      description="Faturamento, novos clientes, prospecção, projetos, margem e cenários (conservador, realista, agressivo)."
    />
  );
}
