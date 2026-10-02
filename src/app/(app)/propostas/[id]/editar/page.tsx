import { notFound, redirect } from "next/navigation";
import { requirePermission, isDirector } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteBuilder } from "../../quote-builder";
import { dateInputSP, loadBuilderData } from "../../builder-data";

export default async function EditQuotePage({ params }: PageProps<"/propostas/[id]/editar">) {
  const user = await requirePermission(permKey("CRM", "EDIT"));
  const { id } = await params;
  const proposal = await db.proposal.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!proposal) notFound();
  if (proposal.status === "ACEITA") redirect(`/propostas/${id}`);
  const data = await loadBuilderData(user.organizationId);

  return (
    <div>
      <PageHeader title="Editar orçamento" description={proposal.title} />
      <QuoteBuilder
        initial={{
          id: proposal.id,
          title: proposal.title,
          leadId: proposal.clientId ? null : proposal.leadId,
          clientId: proposal.clientId,
          recipientName: proposal.recipientName ?? "",
          recipientPhone: proposal.recipientPhone ?? "",
          intro: proposal.intro ?? "",
          notes: proposal.notes ?? "",
          validUntil: proposal.validUntil ? dateInputSP(proposal.validUntil) : "",
          currency: proposal.currency === "USD" ? "USD" : "BRL",
          discountPercent: Number(proposal.discountPercent),
          maxInstallments: proposal.maxInstallments,
          items: proposal.items.map((i) => ({
            key: i.id,
            serviceId: i.serviceId,
            name: i.name,
            tagline: i.tagline,
            features: i.features,
            billing: i.billing,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            minPrice: data.catalog.find((s) => s.id === i.serviceId && s.priceIsFrom)?.price ?? null,
            monthlyFee: i.monthlyFee ? Number(i.monthlyFee) : null,
            cardMode: i.cardMode,
            cardPrice: i.cardPrice ? Number(i.cardPrice) : null,
            maxInstallments: i.maxInstallments,
            minMonths: i.minMonths,
            terms: i.terms,
          })),
        }}
        leads={data.leads}
        clients={data.clients}
        services={data.catalog}
        config={data.settings.config}
        canManage={isDirector(user)}
      />
    </div>
  );
}
