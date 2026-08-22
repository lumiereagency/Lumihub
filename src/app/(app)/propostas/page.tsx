import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function ProposalsPage() {
  await requirePermission(permKey("CRM", "VIEW"));
  return <ModulePlaceholder title="Propostas" description="Propostas comerciais vinculadas a leads e clientes." />;
}
