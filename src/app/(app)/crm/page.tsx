import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function CrmPage() {
  await requirePermission(permKey("CRM", "VIEW"));
  return (
    <ModulePlaceholder
      title="CRM e Prospecção"
      description="Pipeline Lead → Contato → Qualificado → Reunião → Proposta → Negociação → Fechado → Perdido."
    />
  );
}
