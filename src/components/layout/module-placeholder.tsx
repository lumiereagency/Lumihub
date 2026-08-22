import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

// Módulo com fundação de dados/RBAC pronta (schema, permissões, navegação),
// mas cuja interface completa ainda será construída em uma fase seguinte do
// roadmap do LUMIHUB — nunca dados fictícios, apenas "em construção" honesto.
export function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={<Construction size={28} />}
        title="Módulo em construção"
        description="Este módulo está planejado no roadmap do LUMIHUB e será implementado em uma próxima fase de desenvolvimento."
      />
    </div>
  );
}
