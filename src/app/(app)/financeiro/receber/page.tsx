import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function ReceivablesPage() {
  await requirePermission(permKey("RECEIVABLES", "VIEW"));
  return (
    <ModulePlaceholder
      title="Contas a Receber"
      description="Cobranças, régua de lembretes e confirmação de pagamentos."
    />
  );
}
