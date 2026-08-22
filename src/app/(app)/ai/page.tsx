import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function AiPage() {
  await requirePermission(permKey("AI", "VIEW"));
  return (
    <ModulePlaceholder
      title="Lumi AI"
      description="Assistente com contexto real do sistema, respeitando as permissões do seu perfil. Requer um provedor de IA conectado em Integrações."
    />
  );
}
