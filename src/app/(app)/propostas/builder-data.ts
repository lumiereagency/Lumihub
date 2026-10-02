import "server-only";
import { db } from "@/lib/db";
import { getPricingSettings } from "@/lib/pricing/settings";
import type { CatalogService } from "./quote-builder";

export function dateInputSP(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function loadBuilderData(organizationId: string) {
  const [leads, clients, services, settings] = await Promise.all([
    db.lead.findMany({
      where: { organizationId, deletedAt: null, stage: { not: "PERDIDO" } },
      select: { id: true, company: true, contactName: true, whatsapp: true, phone: true, convertedClientId: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
    db.client.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, companyName: true, contactName: true, phone: true },
      orderBy: { companyName: "asc" },
    }),
    db.service.findMany({
      where: { organizationId, active: true },
      orderBy: [{ position: "asc" }, { category: "asc" }, { name: "asc" }],
    }),
    getPricingSettings(organizationId),
  ]);

  const catalog: CatalogService[] = services
    .filter((s) => s.defaultPrice != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      tagline: s.tagline,
      features: s.features,
      billing: s.billing,
      currency: s.currency,
      price: Number(s.defaultPrice),
      priceIsFrom: s.priceIsFrom,
      monthlyFee: s.monthlyFee ? Number(s.monthlyFee) : null,
      cardMode: s.cardMode,
      cardPrice: s.cardPrice ? Number(s.cardPrice) : null,
      maxInstallments: s.maxInstallments,
      minMonths: s.minMonths,
      badge: s.badge,
      isAddon: s.isAddon,
      terms: s.terms,
    }));

  return {
    leads: leads.map((l) => ({ kind: "lead" as const, id: l.id, name: l.company, contactName: l.contactName, phone: l.whatsapp ?? l.phone, convertedClientId: l.convertedClientId })),
    clients: clients.map((c) => ({ kind: "client" as const, id: c.id, name: c.companyName, contactName: c.contactName, phone: c.phone })),
    catalog,
    settings,
  };
}
