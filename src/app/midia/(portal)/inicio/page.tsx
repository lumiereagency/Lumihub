import { CalendarClock, Users2, Sparkles } from "lucide-react";
import { requireMediaMember, isMediaLeader } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";

const ROLE_LABEL: Record<string, string> = { LIDER: "Líder de Mídia", MEMBRO: "Membro" };

export default async function MediaPortalHomePage() {
  const user = await requireMediaMember();

  const [member, teamCount] = await Promise.all([
    db.mediaMember.findUnique({
      where: { userId: user.id },
      include: { functions: { include: { function: true } } },
    }),
    db.mediaMember.count({ where: { organizationId: user.organizationId, status: "ACTIVE" } }),
  ]);

  const primaryFunction = member?.functions.find((f) => f.isPrimary)?.function.name ?? null;

  return (
    <div>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description="Portal da equipe de mídia — escalas, disponibilidade e informações do time."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Seu perfil" value={ROLE_LABEL[member?.role ?? "MEMBRO"]} icon={<Sparkles size={18} />} />
        <MetricCard label="Função principal" value={primaryFunction ?? "Não definida"} icon={<CalendarClock size={18} />} />
        <MetricCard label="Membros ativos na equipe" value={String(teamCount)} icon={<Users2 size={18} />} />
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-text-primary">Próxima escala</h2>
          <EmptyState
            icon={<CalendarClock size={28} />}
            title="Nenhuma escala publicada ainda"
            description="O motor de escalas ainda não foi ativado. Esta seção ficará disponível numa próxima etapa do módulo."
          />
        </div>

        {isMediaLeader(user) && (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-text-primary">Solicitações pendentes</h2>
            <EmptyState
              icon={<Users2 size={28} />}
              title="Nenhuma solicitação pendente"
              description="Trocas e solicitações de escala serão exibidas aqui numa próxima etapa do módulo."
            />
          </div>
        )}
      </div>
    </div>
  );
}
