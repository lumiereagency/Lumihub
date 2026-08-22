import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default async function TasksPage() {
  await requirePermission(permKey("TASKS", "VIEW"));
  return <ModulePlaceholder title="Tarefas" description="Tarefas por projeto, responsável e prioridade." />;
}
