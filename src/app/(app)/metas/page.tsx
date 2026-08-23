import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getGoalsWithProgress } from "@/lib/goals/queries";
import { PageHeader } from "@/components/layout/page-header";
import { GoalList } from "./goal-list";

export default async function GoalsPage() {
  const user = await requirePermission(permKey("GOALS", "VIEW"));

  const [groups, organization] = await Promise.all([
    getGoalsWithProgress(user.organizationId),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("GOALS", "CREATE")),
    canEdit: hasPermission(user, permKey("GOALS", "EDIT")),
    canDelete: hasPermission(user, permKey("GOALS", "DELETE")),
  };

  return (
    <div>
      <PageHeader
        title="Metas"
        description="Faturamento, novos clientes, prospecção, projetos, margem e recebimentos, com cenários conservador, realista e agressivo, sempre comparados ao resultado real."
      />
      <GoalList groups={groups} currency={organization.currency} permissions={permissions} />
    </div>
  );
}
