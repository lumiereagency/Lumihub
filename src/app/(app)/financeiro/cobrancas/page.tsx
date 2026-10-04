import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { FINANCE_TABS, filterTabsForUser } from "@/lib/nav";
import { isChannelConnected } from "@/lib/integrations/messaging";
import { getPixSetup } from "@/lib/billing/charge";
import { formatDueDate } from "@/lib/billing/dates";
import { CobrancasView } from "./cobrancas-view";

export default async function CobrancasPage() {
  const user = await requirePermission(permKey("RECEIVABLES", "VIEW"));
  const org = user.organizationId;

  const [templates, reminders, whatsapp, pix, noPhone, waitingProof] = await Promise.all([
    db.messageTemplate.findMany({ where: { organizationId: org }, orderBy: { createdAt: "asc" } }),
    db.paymentReminder.findMany({
      where: { receivable: { organizationId: org } },
      orderBy: [{ sentAt: { sort: "desc", nulls: "last" } }, { scheduledFor: "asc" }],
      take: 120,
      include: { messageTemplate: { select: { name: true } }, receivable: { include: { client: { select: { companyName: true } } } } },
    }),
    isChannelConnected(org, "WHATSAPP"),
    getPixSetup(org),
    db.client.findMany({
      where: { organizationId: org, deletedAt: null, OR: [{ phone: null }, { phone: "" }], accountsReceivable: { some: { status: { in: ["PENDENTE", "ATRASADO"] } } } },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    db.accountReceivable.count({ where: { organizationId: org, status: { in: ["PENDENTE", "ATRASADO"] }, proofSubmittedAt: { not: null } } }),
  ]);

  const canManage = hasPermission(user, permKey("RECEIVABLES", "MANAGE"));

  return (
    <div>
      <PageHeader title="Lumi Cobranças" description="Lembretes automáticos no WhatsApp com link de pagamento e Pix copia e cola." />
      <SectionTabs tabs={filterTabsForUser(FINANCE_TABS, user.permissions)} />
      <CobrancasView
        status={{ whatsapp, pixKey: pix.key, company: pix.name, thanks: pix.thanks, pixSeparate: pix.pixSeparate, waitingProof }}
        noPhone={noPhone}
        templates={templates.map((t) => ({ id: t.id, name: t.name, trigger: t.trigger, channel: t.channel, body: t.body, active: t.active }))}
        reminders={reminders.map((r) => ({
          id: r.id,
          channel: r.channel,
          status: r.status,
          scheduledFor: r.scheduledFor.toISOString(),
          sentAt: r.sentAt?.toISOString() ?? null,
          clientName: r.receivable.client.companyName,
          description: r.receivable.description,
          dueLabel: formatDueDate(r.receivable.dueDate),
          templateName: r.messageTemplate?.name ?? (r.status === "AGENDADO" ? null : "Envio manual"),
          messageBody: r.messageBody,
        }))}
        canManage={canManage}
      />
    </div>
  );
}
