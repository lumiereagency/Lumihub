import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { CapturesView } from "./captures-view";

export default async function CapturesPage() {
  const user = await requirePermission(permKey("CAPTURES", "VIEW"));

  const [captures, clients, projects] = await Promise.all([
    db.capture.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { date: "asc" },
      include: { client: { select: { companyName: true } }, project: { select: { name: true } } },
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
  ]);

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
        }))}
        clients={clients}
        projects={projects}
        permissions={permissions}
      />
    </div>
  );
}
