import "server-only";
import { db } from "@/lib/db";
import { describeChoice, parseChoice, type QuoteBreakdown } from "@/lib/pricing/engine";
import { getPricingSettings } from "@/lib/pricing/settings";
import { quoteForProposal } from "@/lib/pricing/quote";

export interface ContractParty {
  name: string;
  document: string | null;
  address: string | null;
  email?: string | null;
  phone?: string | null;
  representative?: string | null;
  representativeDoc?: string | null;
}

export interface ContractItem {
  name: string;
  tagline: string | null;
  features: string[];
  billing: "MENSAL" | "PONTUAL";
  quantity: number;
  unitPrice: number;
  monthlyFee: number | null;
  terms: string | null;
}

export interface ContractData {
  code: string;
  title: string;
  issuedAt: Date;
  currency: string;
  contratada: ContractParty;
  contratante: ContractParty;
  items: ContractItem[];
  quote: QuoteBreakdown;
  paymentLines: string[];
  pixKey: string | null;
  paymentDay: number | null;
  minMonths: number | null;
  forum: string | null;
  hasMonthly: boolean;
  hasOneTime: boolean;
  hasTravel: boolean;
  hasAds: boolean;
  hasImageCapture: boolean;
}

interface SignerData {
  personType?: "PF" | "PJ";
  representativeDoc?: string | null;
  name?: string;
  document?: string;
  representative?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentDay?: number | null;
}

export async function loadContractData(organizationId: string, proposalId: string): Promise<ContractData | null> {
  const proposal = await db.proposal.findFirst({
    where: { id: proposalId, organizationId },
    include: {
      items: { orderBy: { position: "asc" } },
      client: true,
      lead: { select: { company: true, contactName: true } },
      contract: { select: { id: true, createdAt: true } },
    },
  });
  if (!proposal) return null;

  const settings = await getPricingSettings(organizationId);
  const { quote } = quoteForProposal(proposal, settings.config);
  const signer = (proposal.signerData ?? {}) as SignerData;
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: proposal.currency }).format(v);

  const items: ContractItem[] = proposal.items.map((i) => ({
    name: i.name,
    tagline: i.tagline,
    features: i.features,
    billing: i.billing,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    monthlyFee: i.monthlyFee ? Number(i.monthlyFee) : null,
    terms: i.terms,
  }));
  const text = items.map((i) => `${i.name} ${i.tagline ?? ""} ${i.features.join(" ")} ${i.terms ?? ""}`.toLowerCase()).join(" ");

  return {
    code: (proposal.contract?.id ?? proposal.id).slice(-6).toUpperCase(),
    title: proposal.title,
    issuedAt: proposal.contract?.createdAt ?? new Date(),
    currency: proposal.currency,
    contratada: {
      name: settings.company.legalName,
      document: settings.company.document,
      address: settings.company.address,
      representative: settings.company.representativeName,
      representativeDoc: settings.company.representativeDoc,
      email: settings.company.representativeEmail,
    },
    contratante: {
      name: signer.name || proposal.client?.companyName || proposal.lead?.company || proposal.recipientName || "CONTRATANTE",
      document: signer.document || proposal.client?.cnpj || null,
      address: signer.address || proposal.client?.address || null,
      email: signer.email || proposal.client?.email || null,
      phone: signer.phone || proposal.recipientPhone || proposal.client?.phone || null,
      // Pessoa física assina por si: sem linha de representante no contrato.
      representative: signer.personType === "PF" ? null : signer.representative || proposal.recipientName || proposal.client?.contactName || null,
      representativeDoc: signer.personType === "PF" ? null : (signer.representativeDoc ?? null),
    },
    items,
    quote,
    paymentLines: describeChoice(parseChoice(proposal.chosenPayment), quote, fmt),
    pixKey: settings.pixKey,
    paymentDay: signer.paymentDay ?? null,
    minMonths: quote.minMonths,
    forum: settings.company.city,
    hasMonthly: !!quote.monthly,
    hasOneTime: !!quote.oneTime,
    hasTravel: /locomo|diária|captação|evento|drone/.test(text),
    hasAds: /tráfego|anúncio|anuncio/.test(text),
    hasImageCapture: /vídeo|video|foto|captação|produção|filme|evento|drone/.test(text),
  };
}
