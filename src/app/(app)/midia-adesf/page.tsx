import Link from "next/link";
import { Users2, Mail, Clapperboard, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { ensureMediaAdesfDefaults } from "@/lib/media/bootstrap";
import { MEDIA_ROLE_LABELS, MEDIA_STATUS_LABELS, MEDIA_STATUS_TONE } from "@/lib/media/labels";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default async function MediaAdesfDashboardPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));
  await ensureMediaAdesfDefaults(user.organizationId);

  const [activeMembers, invited, functionsActive, brand, recentMembers] = await Promise.all([
    db.mediaMember.findMany({
      where: { organizationId: user.organizationId, status: "ACTIVE" },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        functions: { include: { function: true } },
        _count: { select: { availabilityRecurring: true } },
      },
    }),
    db.mediaMember.count({ where: { organizationId: user.organizationId, status: "INVITED" } }),
    db.mediaFunction.count({ where: { organizationId: user.organizationId, active: true } }),
    db.mediaBrandSettings.findUnique({ where: { organizationId: user.organizationId } }),
    db.mediaMember.findMany({
      where: { organizationId: user.organizationId },
      include: { user: { select: { name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const withAvailability = activeMembers.filter((m) => m._count.availabilityRecurring > 0).length;
  const withoutAvailability = activeMembers.length - withAvailability;
  const identityConfigured = !!brand?.logoUrl;
  const functionsConfigured = functionsActive > 0;

  return (
    <div>
      <PageHeader title="Mídia ADESF" description="Gestão da equipe de mídia — visão geral." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Membros ativos" value={String(activeMembers.length)} icon={<Users2 size={18} />} />
        <MetricCard label="Convites pendentes" value={String(invited)} icon={<Mail size={18} />} />
        <MetricCard label="Funções ativas" value={String(functionsActive)} icon={<Clapperboard size={18} />} />
        <MetricCard
          label="Disponibilidade configurada"
          value={activeMembers.length > 0 ? `${withAvailability}/${activeMembers.length}` : "0/0"}
          icon={<Clock size={18} />}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Equipe</h2>
          {recentMembers.length === 0 ? (
            <EmptyState icon={<Users2 size={28} />} title="Nenhum membro cadastrado ainda" />
          ) : (
            <div className="flex flex-col gap-2">
              {recentMembers.map((m) => (
                <Link
                  key={m.id}
                  href={`/midia-adesf/equipe/${m.id}`}
                  className="flex items-center gap-3 rounded-[10px] border border-border bg-card px-3 py-2 hover:bg-card-elevated"
                >
                  <Avatar name={m.user.name} src={m.user.avatarUrl} size="sm" />
                  <span className="flex-1 truncate text-sm text-text-primary">{m.user.name}</span>
                  <Badge tone="neutral">{MEDIA_ROLE_LABELS[m.role]}</Badge>
                  <Badge tone={MEDIA_STATUS_TONE[m.status]}>{MEDIA_STATUS_LABELS[m.status]}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Configuração inicial</h2>
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <ChecklistItem done={functionsConfigured} label="Funções cadastradas" />
            <ChecklistItem done={identityConfigured} label="Identidade visual configurada" />
            <ChecklistItem
              done={withoutAvailability === 0 && activeMembers.length > 0}
              label={
                activeMembers.length === 0
                  ? "Nenhum membro ativo ainda"
                  : withoutAvailability === 0
                    ? "Todos os membros configuraram disponibilidade"
                    : `${withoutAvailability} membro(s) ainda não configuraram disponibilidade`
              }
            />
          </div>
        </section>
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

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? <CheckCircle2 size={16} className="text-success" /> : <AlertTriangle size={16} className="text-warning" />}
      <span className={done ? "text-text-primary" : "text-text-secondary"}>{label}</span>
    </div>
  );
}
