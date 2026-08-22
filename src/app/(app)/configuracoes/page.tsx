import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function SettingsPage() {
  await requirePermission(permKey("SETTINGS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Configurações"
      description="Preferências gerais da organização: fuso horário, moeda e idioma."
    />
  );
}
