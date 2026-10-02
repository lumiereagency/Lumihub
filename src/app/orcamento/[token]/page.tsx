import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Poppins } from "next/font/google";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getPricingSettings } from "@/lib/pricing/settings";
import { quoteForProposal } from "@/lib/pricing/quote";
import { parseChoice } from "@/lib/pricing/engine";
import { QuoteView } from "./quote-view";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-poppins" });

export const metadata: Metadata = {
  title: "Seu orçamento · Lumière",
  description: "Orçamento personalizado preparado pela Lumière.",
  robots: { index: false, follow: false },
};

async function loadProposal(token: string) {
  if (!token || token.length < 16 || token.length > 64) return null;
  return db.proposal.findUnique({
    where: { publicToken: token },
    include: {
      items: { orderBy: { position: "asc" } },
      lead: { select: { company: true } },
      client: { select: { companyName: true } },
      createdBy: { select: { name: true } },
      contract: { select: { signatureLink: true, signatureStatus: true, status: true } },
    },
  });
}

export default async function PublicQuotePage({ params }: PageProps<"/orcamento/[token]">) {
  const { token } = await params;
  const proposal = await loadProposal(token);
  if (!proposal) notFound();

  // Visualização conta só quando quem abre não é alguém logado da equipe.
  const viewer = await getCurrentUser().catch(() => null);
  const isTeam = viewer?.organizationId === proposal.organizationId;
  if (!isTeam && proposal.status !== "ACEITA") {
    const now = new Date();
    // Rascunho aberto por alguém de fora: o link já saiu, então conta como enviado.
    const wasDraft = proposal.status === "RASCUNHO";
    await db.proposal.update({
      where: { id: proposal.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: now,
        ...(proposal.viewedAt ? {} : { viewedAt: now }),
        ...(wasDraft ? { status: "ENVIADA", sentAt: proposal.sentAt ?? now } : {}),
      },
    });
    if (wasDraft) proposal.status = "ENVIADA";
    if (!proposal.viewedAt && proposal.createdByUserId) {
      await db.notification.create({
        data: {
          organizationId: proposal.organizationId,
          userId: proposal.createdByUserId,
          title: "Orçamento aberto 👀",
          body: `${proposal.recipientName?.split(" ")[0] ?? "O cliente"} acabou de abrir "${proposal.title}".`,
          link: `/propostas/${proposal.id}`,
        },
      });
    }
  }

  const settings = await getPricingSettings(proposal.organizationId);
  const { quote } = quoteForProposal(proposal, settings.config);

  return (
    <div className={poppins.variable}>
      <QuoteView
        token={token}
        isTeamPreview={isTeam}
        proposal={{
          code: proposal.id.slice(-6).toUpperCase(),
          title: proposal.title,
          company: proposal.client?.companyName ?? proposal.lead?.company ?? null,
          recipientName: proposal.recipientName,
          sellerName: proposal.createdBy?.name ?? null,
          intro: proposal.intro,
          validUntil: proposal.validUntil?.toISOString() ?? null,
          expired: !!proposal.validUntil && proposal.validUntil.getTime() < new Date().getTime(),
          status: proposal.status,
          response: proposal.response,
          responseMessage: proposal.responseMessage,
          chosenPayment: parseChoice(proposal.chosenPayment),
          minMonths: proposal.minMonths,
          currency: proposal.currency,
          discountPercent: Number(proposal.discountPercent),
          signatureLink: proposal.contract?.signatureStatus === "SIGNED" ? null : (proposal.contract?.signatureLink ?? null),
          signed: proposal.contract?.signatureStatus === "SIGNED",
          items: proposal.items.map((i) => ({
            id: i.id,
            name: i.name,
            tagline: i.tagline,
            features: i.features,
            billing: i.billing,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            monthlyFee: i.monthlyFee ? Number(i.monthlyFee) : null,
            terms: i.terms,
            cardMode: i.cardMode,
            cardPrice: i.cardPrice ? Number(i.cardPrice) : null,
            maxInstallments: i.maxInstallments,
          })),
        }}
        quote={quote}
        pixKey={settings.pixKey}
        companyName={settings.company.legalName}
      />
    </div>
  );
}
