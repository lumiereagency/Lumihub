import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function InvestmentsPage() {
  await requirePermission(permKey("INVESTMENTS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Investimentos"
      description="Equipamentos, tecnologia, marketing e expansão com objetivo e retorno esperado."
    />
  );
}
