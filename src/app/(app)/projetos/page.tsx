import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function ProjectsPage() {
  await requirePermission(permKey("PROJECTS", "VIEW"));
  return (
    <ModulePlaceholder
      title="Projetos"
      description="Kanban, lista, timeline e calendário de projetos por cliente e responsável."
    />
  );
}
