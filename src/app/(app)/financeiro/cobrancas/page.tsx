import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { FINANCE_TABS, filterTabsForUser } from "@/lib/nav";
import { CobrancasView } from "./cobrancas-view";

export default async function CobrancasPage() {
  const user = await requirePermission(permKey("RECEIVABLES", "VIEW"));

  const [templates, reminders] = await Promise.all([
    db.messageTemplate.findMany({ where: { organizationId: user.organizationId }, orderBy: { createdAt: "asc" } }),
    db.paymentReminder.findMany({
      where: { receivable: { organizationId: user.organizationId } },
      orderBy: { scheduledFor: "desc" },
      take: 100,
      include: { receivable: { include: { client: { select: { companyName: true } } } } },
    }),
  ]);

  const canManage = hasPermission(user, permKey("RECEIVABLES", "MANAGE"));

  return (
    <div>
      <PageHeader title="Lumi Cobranças" description="Régua de lembretes configurável para contas a receber." />
      <SectionTabs tabs={filterTabsForUser(FINANCE_TABS, user.permissions)} />
      <CobrancasView
        templates={templates}
        reminders={reminders.map((r) => ({
          id: r.id,
          offsetDays: r.offsetDays,
          channel: r.channel,
          status: r.status,
          scheduledFor: r.scheduledFor.toISOString(),
          sentAt: r.sentAt?.toISOString() ?? null,
          clientName: r.receivable.client.companyName,
          description: r.receivable.description,
        }))}
        canManage={canManage}
      />
    </div>
  );
}
