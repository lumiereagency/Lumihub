import { requirePermission, isDirector } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { CRM_TABS, filterTabsForUser } from "@/lib/nav";
import { getPricingSettings } from "@/lib/pricing/settings";
import { ServiceCatalog } from "./service-catalog";

export default async function ServicesPage() {
  const user = await requirePermission(permKey("CRM", "VIEW"));

  const [services, pricing] = await Promise.all([
    db.service.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ position: "asc" }, { category: "asc" }, { name: "asc" }],
      include: { _count: { select: { leads: true, clients: true } } },
    }),
    getPricingSettings(user.organizationId),
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
          billing: s.billing,
          currency: s.currency,
          tagline: s.tagline,
          features: s.features,
          badge: s.badge,
          priceIsFrom: s.priceIsFrom,
          monthlyFee: s.monthlyFee ? Number(s.monthlyFee) : null,
          cardMode: s.cardMode,
          cardPrice: s.cardPrice ? Number(s.cardPrice) : null,
          maxInstallments: s.maxInstallments,
          minMonths: s.minMonths,
          isAddon: s.isAddon,
          terms: s.terms,
          fromGuide: !!s.guideKey,
          commissionPercent: s.commissionPercent != null ? Number(s.commissionPercent) : null,
          commissionFixed: s.commissionFixed != null ? Number(s.commissionFixed) : null,
        }))}
        config={pricing.config}
        canManage={isDirector(user)}
      />
    </div>
  );
}
