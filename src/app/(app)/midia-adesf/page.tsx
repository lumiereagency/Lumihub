import { Users2, UserCheck, Mail, Clapperboard } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { ensureMediaAdesfDefaults } from "@/lib/media/bootstrap";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MediaAdesfDashboardPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));
  await ensureMediaAdesfDefaults(user.organizationId);

  const [active, invited, functions, leaders] = await Promise.all([
    db.mediaMember.count({ where: { organizationId: user.organizationId, status: "ACTIVE" } }),
    db.mediaMember.count({ where: { organizationId: user.organizationId, status: "INVITED" } }),
    db.mediaFunction.count({ where: { organizationId: user.organizationId, active: true } }),
    db.mediaMember.count({ where: { organizationId: user.organizationId, status: "ACTIVE", role: "LIDER" } }),
  ]);

  return (
    <div>
      <PageHeader title="Mídia ADESF" description="Gestão da equipe de mídia — visão geral." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Membros ativos" value={String(active)} icon={<Users2 size={18} />} />
        <MetricCard label="Líderes" value={String(leaders)} icon={<UserCheck size={18} />} />
        <MetricCard label="Convites pendentes" value={String(invited)} icon={<Mail size={18} />} />
        <MetricCard label="Funções ativas" value={String(functions)} icon={<Clapperboard size={18} />} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Escalas e cultos</h2>
        <EmptyState
          icon={<Clapperboard size={28} />}
          title="Disponível na próxima etapa"
          description="Motor de escalas, geração automática e relatórios avançados são objeto de fases futuras do Mídia ADESF."
        />
      </div>
    </div>
  );
}
