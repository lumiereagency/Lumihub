import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function CalendarPage() {
  await requirePermission(permKey("CALENDAR", "VIEW"));
  return (
    <ModulePlaceholder
      title="Agenda"
      description="Calendário integrado de captações, reuniões, entregas, vencimentos e contratos."
    />
  );
}
