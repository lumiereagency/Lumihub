import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { CapturesView } from "./captures-view";

export default async function CapturesPage() {
  const user = await requirePermission(permKey("CAPTURES", "VIEW"));

  const [captures, clients, projects, teamMembers] = await Promise.all([
    db.capture.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { date: "asc" },
      include: {
        client: { select: { companyName: true } },
        project: { select: { name: true } },
        assignments: { select: { role: true, userId: true, status: true } },
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
    db.teamMember.findMany({
      where: { organizationId: user.organizationId, active: true, userId: { not: null } },
      select: { userId: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const crewAccounts = teamMembers
    .filter((m): m is typeof m & { userId: string } => !!m.userId)
    .map((m) => ({ userId: m.userId, name: m.name, role: m.role }));

  const permissions = {
    canCreate: hasPermission(user, permKey("CAPTURES", "CREATE")),
    canEdit: hasPermission(user, permKey("CAPTURES", "EDIT")),
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
