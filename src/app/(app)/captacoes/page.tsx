import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { CapturesView } from "./captures-view";

export default async function CapturesPage() {
  const user = await requirePermission(permKey("CAPTURES", "VIEW"));

  const [captures, clients, projects, crewUsers, paidFolhas] = await Promise.all([
    db.capture.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { date: "asc" },
      include: {
        client: { select: { companyName: true } },
        project: { select: { name: true } },
        assignments: { select: { id: true, role: true, userId: true, status: true, fee: true, feeManual: true, payableId: true, user: { select: { name: true } } } },
      },
    }),
    db.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    db.project.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Qualquer pessoa ativa da base pode ser escalada (inclusive a gestão e a diretoria).
    db.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null, role: { key: { not: "MEDIA_ONLY" } } },
      select: { id: true, name: true, role: { select: { name: true } }, teamMemberProfile: { select: { role: true } } },
      orderBy: { name: "asc" },
    }),
    db.accountPayable.findMany({ where: { organizationId: user.organizationId, kind: "FOLHA", status: "PAGO" }, select: { id: true } }),
  ]);

  const crewAccounts = crewUsers.map((u) => ({ userId: u.id, name: u.name, role: u.teamMemberProfile?.role ?? u.role.name }));
  const paidSet = new Set(paidFolhas.map((p) => p.id));
  const permissions = {
    canCreate: hasPermission(user, permKey("CAPTURES", "CREATE")),
    canEdit: hasPermission(user, permKey("CAPTURES", "EDIT")),
    canDelete: hasPermission(user, permKey("CAPTURES", "DELETE")),
    // Quem monta equipe vê os cachês (diretoria e gestão com edição de captações).
    canSeeFees: hasPermission(user, permKey("CAPTURES", "EDIT")),
  };

  return (
    <div>
      <PageHeader title="Captações" description="Agendamento de captações com equipe, equipamentos e status de entrega." />
      <CapturesView
        captures={captures.map((c) => ({
          id: c.id,
          clientId: c.clientId,
          projectId: c.projectId,
          date: c.date.toISOString(),
          location: c.location,
          status: c.status,
          videomaker: c.videomaker,
          photographer: c.photographer,
          storymaker: c.storymaker,
          droneOperator: c.droneOperator,
          videoCount: c.videoCount,
          photoCount: c.photoCount,
          scriptNotes: c.scriptNotes,
          equipment: c.equipment,
          clientName: c.client.companyName,
          projectName: c.project?.name ?? null,
          videomakerUserId: c.assignments.find((a) => a.role === "VIDEOMAKER")?.userId ?? null,
          photographerUserId: c.assignments.find((a) => a.role === "PHOTOGRAPHER")?.userId ?? null,
          storymakerUserId: c.assignments.find((a) => a.role === "STORYMAKER")?.userId ?? null,
          droneOperatorUserId: c.assignments.find((a) => a.role === "DRONE_OPERATOR")?.userId ?? null,
          crew: c.assignments.map((a) => ({
            id: a.id,
            role: a.role,
            name: a.user.name,
            status: a.status,
            fee: a.fee !== null ? Number(a.fee) : null,
            feeManual: a.feeManual,
            paid: !!a.payableId && paidSet.has(a.payableId),
          })),
          assignmentStatuses: Object.fromEntries(c.assignments.map((a) => [a.role, a.status])) as Record<
            string,
            "PENDENTE" | "ACEITO" | "RECUSADO"
          >,
        }))}
        clients={clients}
        projects={projects}
        crewAccounts={crewAccounts}
        permissions={permissions}
      />
    </div>
  );
}
