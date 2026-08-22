import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function CapturesPage() {
  await requirePermission(permKey("CAPTURES", "VIEW"));
  return (
    <ModulePlaceholder
      title="Captações"
      description="Agendamento de captações com equipe, equipamentos e status de entrega."
    />
  );
}
