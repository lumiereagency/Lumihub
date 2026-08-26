import { redirect, notFound } from "next/navigation";
import { History } from "lucide-react";
import { requireMediaMember, isMediaLeader } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { MEDIA_ROLE_LABELS, MEDIA_STATUS_LABELS, MEDIA_STATUS_TONE } from "@/lib/media/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MemberAccessForm } from "@/components/media/member-access-form";
import { MemberFunctionsPanel } from "@/components/media/member-functions-panel";
import { MemberAvailabilityView } from "@/components/media/member-availability-view";

// Gestão de um membro pelo LÍDER — de dentro do portal (não da área
// administrativa da LUMIBASE, que segue exclusiva de admins). Reaproveita
// os mesmos componentes/Server Actions da tela administrativa
// equivalente; o guard de permissão real está nas próprias Actions
// (media-actions.ts), então um MEMBRO comum tentando acessar esta rota
// direto pela URL (IDOR) é barrado tanto aqui quanto na Action.
export default async function MediaPortalMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireMediaMember();
  if (!isMediaLeader(user)) redirect("/midia/inicio");
  const { id } = await params;

  const member = await db.mediaMember.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      user: { select: { name: true, email: true, avatarUrl: true, lastLoginAt: true } },
      functions: { include: { function: true, mentor: { include: { user: { select: { name: true } } } } } },
      availabilityRecurring: { orderBy: { dayOfWeek: "asc" } },
      availabilityExceptions: { where: { date: { gte: new Date() } }, orderBy: { date: "asc" } },
    },
  });
  if (!member) notFound();

  const allFunctions = await db.mediaFunction.findMany({
    where: { organizationId: user.organizationId, active: true },
    orderBy: { displayOrder: "asc" },
  });

  const mentorCandidates = await db.mediaMemberFunction.findMany({
    where: {
      memberId: { not: member.id },
      status: { in: ["HABILITADO", "AVANCADO"] },
      function: { organizationId: user.organizationId },
    },
    include: { member: { include: { user: { select: { name: true } } } } },
  });
  const mentorsByFunction = new Map<string, { id: string; name: string }[]>();
  for (const mf of mentorCandidates) {
    const list = mentorsByFunction.get(mf.functionId) ?? [];
    list.push({ id: mf.memberId, name: mf.member.user.name });
    mentorsByFunction.set(mf.functionId, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={member.user.name}
        description={member.user.email}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={member.role === "LIDER" ? "accent" : "neutral"}>{MEDIA_ROLE_LABELS[member.role]}</Badge>
            <Badge tone={MEDIA_STATUS_TONE[member.status]}>{MEDIA_STATUS_LABELS[member.status]}</Badge>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <Avatar name={member.user.name} src={member.user.avatarUrl} size="lg" />
        <div className="text-sm text-text-tertiary">
          {member.user.lastLoginAt ? `Último acesso: ${member.user.lastLoginAt.toLocaleString("pt-BR")}` : "Ainda não acessou o portal."}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Funções</h2>
        <MemberFunctionsPanel
          memberId={member.id}
          assignments={member.functions.map((f) => ({
            functionId: f.functionId,
            isPrimary: f.isPrimary,
            status: f.status,
            mentorMemberId: f.mentorMemberId,
          }))}
          availableFunctions={allFunctions.map((f) => ({ id: f.id, name: f.name }))}
          mentorsByFunction={Object.fromEntries(mentorsByFunction)}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Disponibilidade</h2>
        <MemberAvailabilityView recurring={member.availabilityRecurring} exceptions={member.availabilityExceptions} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Acesso e Administração</h2>
        <MemberAccessForm
          memberId={member.id}
          role={member.role}
          status={member.status}
          phone={member.phone}
          administrativeNotes={member.administrativeNotes}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Histórico</h2>
        <EmptyState icon={<History size={28} />} title="Disponível na próxima etapa" />
      </section>
    </div>
  );
}
