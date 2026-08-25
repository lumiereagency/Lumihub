import { requireMediaMember, isMediaLeader } from "@/lib/auth/guard";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/auth/guard";
import { MEDIA_PORTAL_TEAM_VIEW } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Users2 } from "lucide-react";

const ROLE_LABEL: Record<string, string> = { LIDER: "Líder", MEMBRO: "Membro" };

export default async function MediaPortalTeamPage() {
  const user = await requireMediaMember();
  // Equipe do portal é um privilégio adicional de LIDER — MEMBRO não vê a
  // lista de colegas (redação de privacidade exigida pela especificação).
  if (!hasPermission(user, MEDIA_PORTAL_TEAM_VIEW)) redirect("/midia/inicio");

  const members = await db.mediaMember.findMany({
    where: { organizationId: user.organizationId, status: "ACTIVE" },
    include: { user: { select: { name: true, avatarUrl: true } }, functions: { include: { function: true } } },
    orderBy: { user: { name: "asc" } },
  });

  const showContact = isMediaLeader(user);

  return (
    <div>
      <PageHeader title="Equipe de Mídia" description="Membros ativos do time — visão somente leitura." />

      {members.length === 0 ? (
        <EmptyState icon={<Users2 size={28} />} title="Nenhum membro ativo ainda" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const primary = m.functions.find((f) => f.isPrimary)?.function.name;
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <Avatar name={m.user.name} src={m.user.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{m.user.name}</p>
                  <p className="truncate text-xs text-text-tertiary">{primary ?? "Sem função principal definida"}</p>
                  {showContact && m.phone && <p className="truncate text-xs text-text-tertiary">{m.phone}</p>}
                </div>
                <Badge tone={m.role === "LIDER" ? "accent" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
