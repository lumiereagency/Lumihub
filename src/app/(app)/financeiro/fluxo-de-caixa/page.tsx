import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function CashFlowPage() {
  await requirePermission(permKey("FINANCE", "VIEW"));
  return (
    <ModulePlaceholder
      title="Fluxo de Caixa"
      description="Previsão de caixa em 7, 30, 90 dias, 6 e 12 meses, com ponto de equilíbrio e reserva operacional."
    />
  );
}
