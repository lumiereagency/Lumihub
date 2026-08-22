import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function CardsPage() {
  await requirePermission(permKey("CARDS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Cartões"
      description="Cartões de crédito, compras parceladas e distribuição automática nas faturas."
    />
  );
}
