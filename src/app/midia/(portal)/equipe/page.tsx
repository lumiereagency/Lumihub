import { requireMediaMember, isMediaLeader } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { PortalTeamList } from "@/components/media/portal-team-list";

// Equipe é visível a todo membro (MEMBRO também pode "visualizar equipe" —
// §13), só com redação de privacidade: e-mail, notas internas, último
// acesso e permissões nunca aparecem aqui, mesmo para o LÍDER. Só o LÍDER
// ganha telefone e o atalho de gestão (convidar/editar membro).
export default async function MediaPortalTeamPage() {
  const user = await requireMediaMember();
  const isLeader = isMediaLeader(user);

  const [members, allFunctions] = await Promise.all([
    db.mediaMember.findMany({
      where: { organizationId: user.organizationId, status: "ACTIVE" },
      include: { user: { select: { name: true, avatarUrl: true } }, functions: { include: { function: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.mediaFunction.findMany({ where: { organizationId: user.organizationId, active: true }, orderBy: { displayOrder: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Equipe de Mídia"
        description={isLeader ? "Membros ativos do time." : "Membros ativos do time — visão somente leitura."}
      />
      <PortalTeamList
        isLeader={isLeader}
        allFunctions={allFunctions.map((f) => ({ id: f.id, name: f.name }))}
        members={members.map((m) => ({
          id: m.id,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          phone: m.phone,
          primaryFunction: m.functions.find((f) => f.isPrimary)?.function.name ?? null,
          enabledFunctions: m.functions.filter((f) => !f.isPrimary).map((f) => f.function.name),
        }))}
      />
    </div>
  );
}
