import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function DocumentsPage() {
  await requirePermission(permKey("DOCUMENTS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Documentos"
      description="Contratos, propostas, briefings, comprovantes e notas fiscais."
    />
  );
}
