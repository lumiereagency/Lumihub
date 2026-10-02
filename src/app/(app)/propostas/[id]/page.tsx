import { notFound } from "next/navigation";
import { requirePermission, hasPermission, isDirector } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { describeChoice, parseChoice } from "@/lib/pricing/engine";
import { fillTemplate, getPricingSettings } from "@/lib/pricing/settings";
import { quoteForProposal } from "@/lib/pricing/quote";
import { isChannelConnected } from "@/lib/integrations/messaging";
import { getAutentiqueCredentials } from "@/lib/integrations/autentique";
import type { StoredSigner } from "@/lib/contracts/signature-sync";
import { SectionTabs } from "@/components/layout/section-tabs";
import { CRM_TABS, filterTabsForUser } from "@/lib/nav";
import { QuoteDetail } from "./quote-detail";

export default async function QuoteDetailPage({ params }: PageProps<"/propostas/[id]">) {
  const user = await requirePermission(permKey("CRM", "VIEW"));
  const { id } = await params;
  const proposal = await db.proposal.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      items: { orderBy: { position: "asc" } },
      lead: { select: { id: true, company: true } },
      client: { select: { id: true, companyName: true } },
      createdBy: { select: { name: true } },
      contract: true,
    },
  });
  if (!proposal) notFound();

  const [settings, whatsappConnected, autentique] = await Promise.all([
    getPricingSettings(user.organizationId),
    isChannelConnected(user.organizationId, "WHATSAPP"),
    getAutentiqueCredentials(user.organizationId),
  ]);
  const { quote } = quoteForProposal(proposal, settings.config);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const link = proposal.publicToken ? `${appUrl}/orcamento/${proposal.publicToken}` : null;
  const firstName = (proposal.recipientName ?? "").split(" ")[0] || "tudo bem";
  const signer = (proposal.signerData ?? null) as Record<string, string | number | null> | null;
  const money = (v: number) => formatCurrency(v, proposal.currency);

  const quoteMessage = fillTemplate(settings.whatsappTemplate, {
    nome: firstName,
    vendedor: user.name.split(" ")[0],
    titulo: proposal.title,
    link: link ?? "",
    validade: proposal.validUntil ? formatDate(proposal.validUntil) : "",
  });
  const contractMessage = fillTemplate(settings.contractMessage, {
    nome: (typeof signer?.representative === "string" && signer.representative ? signer.representative : (proposal.recipientName ?? "")).split(" ")[0] || "tudo bem",
    vendedor: user.name.split(" ")[0],
    titulo: proposal.title,
    validade: "",
  });

  const canContract = hasPermission(user, permKey("CONTRACTS", "CREATE")) || hasPermission(user, permKey("CRM", "MANAGE"));

  return (
    <div>
      <SectionTabs tabs={filterTabsForUser(CRM_TABS, user.permissions)} />
      <QuoteDetail
        proposal={{
          id: proposal.id,
          title: proposal.title,
          status: proposal.status,
          party: proposal.client ? { kind: "client", id: proposal.client.id, name: proposal.client.companyName } : proposal.lead ? { kind: "lead", id: proposal.lead.id, name: proposal.lead.company } : null,
          recipientName: proposal.recipientName,
          recipientPhone: proposal.recipientPhone,
          createdBy: proposal.createdBy?.name ?? null,
          createdAt: proposal.createdAt.toISOString(),
          sentAt: proposal.sentAt?.toISOString() ?? null,
          validUntil: proposal.validUntil?.toISOString() ?? null,
          viewedAt: proposal.viewedAt?.toISOString() ?? null,
          lastViewedAt: proposal.lastViewedAt?.toISOString() ?? null,
          viewCount: proposal.viewCount,
          response: proposal.response,
          responseMessage: proposal.responseMessage,
          respondedAt: proposal.respondedAt?.toISOString() ?? null,
          paymentLines: describeChoice(parseChoice(proposal.chosenPayment), quote, money),
          signer: signer
            ? {
                personType: signer.personType === "PF" ? "PF" : signer.personType === "PJ" ? "PJ" : null,
                representativeDoc: signer.representativeDoc ? String(signer.representativeDoc) : null,
                name: String(signer.name ?? ""),
                document: String(signer.document ?? ""),
                representative: signer.representative ? String(signer.representative) : null,
                email: String(signer.email ?? ""),
                phone: String(signer.phone ?? ""),
                address: String(signer.address ?? ""),
                paymentDay: typeof signer.paymentDay === "number" ? signer.paymentDay : null,
              }
            : null,
          notes: proposal.notes,
          legacy: proposal.items.length === 0,
          legacyValue: Number(proposal.value),
          items: proposal.items.map((i) => ({
            id: i.id,
            name: i.name,
            billing: i.billing,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            monthlyFee: i.monthlyFee ? Number(i.monthlyFee) : null,
          })),
          currency: proposal.currency,
          contract: proposal.contract
            ? {
                id: proposal.contract.id,
                status: proposal.contract.status,
                signatureStatus: proposal.contract.signatureStatus,
                signatureLink: proposal.contract.signatureLink,
                signatureSentAt: proposal.contract.signatureSentAt?.toISOString() ?? null,
                signedAt: proposal.contract.signedAt?.toISOString() ?? null,
                signedFileUrl: proposal.contract.signedFileUrl,
                signers: ((proposal.contract.signatureSigners ?? []) as unknown as StoredSigner[]).map((s) => ({
                  role: s.role,
                  name: s.name,
                  email: s.email,
                  signedAt: s.signedAt,
                  rejectedAt: s.rejectedAt,
                  viewedAt: s.viewedAt ?? null,
                })),
              }
            : null,
        }}
        quote={quote}
        link={link}
        quoteMessage={quoteMessage}
        contractMessage={contractMessage}
        whatsappConnected={whatsappConnected}
        autentique={autentique ? { connected: true, sandbox: autentique.sandbox } : { connected: false, sandbox: false }}
        companyReady={!!settings.company.document && !!settings.company.address}
        permissions={{
          canEdit: hasPermission(user, permKey("CRM", "EDIT")),
          canCreate: hasPermission(user, permKey("CRM", "CREATE")),
          canDelete: hasPermission(user, permKey("CRM", "DELETE")),
          canContract,
          canManage: isDirector(user),
        }}
      />
    </div>
  );
}
