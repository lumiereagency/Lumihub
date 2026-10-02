import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { CRM_TABS, filterTabsForUser } from "@/lib/nav";
import { ServiceCatalog } from "./service-catalog";

export default async function ServicesPage() {
  const user = await requirePermission(permKey("CRM", "VIEW"));

  const [services, organization] = await Promise.all([
    db.service.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { _count: { select: { leads: true, clients: true } } },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  return (
    <div>
      <PageHeader title="CRM e Prospecção" description="Os serviços e produtos que o time pode oferecer — já organizados para marcar em cada lead e cliente." />
      <SectionTabs tabs={filterTabsForUser(CRM_TABS, user.permissions)} />
      <ServiceCatalog
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
          defaultPrice: s.defaultPrice ? Number(s.defaultPrice) : null,
          active: s.active,
          leadCount: s._count.leads,
          clientCount: s._count.clients,
        }))}
        currency={organization.currency}
        canManage={hasPermission(user, permKey("CRM", "MANAGE"))}
      />
    </div>
  );
}
