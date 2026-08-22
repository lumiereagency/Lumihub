import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { TeamList } from "../team-list";

export default async function FreelancersPage() {
  const user = await requirePermission(permKey("TEAM", "VIEW"));

  const [members, users, organization] = await Promise.all([
    db.teamMember.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      include: { _count: { select: { projects: true } } },
    }),
    db.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("TEAM", "CREATE")),
    canEdit: hasPermission(user, permKey("TEAM", "EDIT")),
  };

  return (
    <div>
      <PageHeader title="Freelancers" description="Cadastro de freelancers e prestadores parceiros." />
      <TeamList
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          type: m.type,
          userId: m.userId,
          paymentValue: m.paymentValue ? Number(m.paymentValue) : null,
          paymentMethod: m.paymentMethod,
          paymentDay: m.paymentDay,
          active: m.active,
          projectsCount: m._count.projects,
        }))}
        availableUsers={users}
        currency={organization.currency}
        permissions={permissions}
        typeFilter={["FREELANCER", "PRESTADOR"]}
        emptyLabel="Nenhum freelancer ou prestador cadastrado ainda"
        createLabel="Novo freelancer"
      />
    </div>
  );
}
