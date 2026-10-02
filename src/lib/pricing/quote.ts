import "server-only";
import { computeQuote, normalizeConfig, type PricedItem, type PricingConfig, type QuoteBreakdown } from "@/lib/pricing/engine";

interface DbItem {
  billing: "MENSAL" | "PONTUAL";
  quantity: number;
  unitPrice: { toString(): string } | number;
  monthlyFee: { toString(): string } | number | null;
  cardMode: "AUTO" | "FIXED" | "NONE";
  cardPrice: { toString(): string } | number | null;
  maxInstallments: number | null;
  minMonths: number | null;
}

interface DbProposal {
  currency: string;
  discountPercent: { toString(): string } | number;
  maxInstallments: number | null;
  pricingSnapshot: unknown;
  items: DbItem[];
}

const n = (v: { toString(): string } | number | null | undefined) => (v == null ? null : Number(v));

export function toPricedItems(items: DbItem[]): PricedItem[] {
  return items.map((i) => ({
    billing: i.billing,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    monthlyFee: n(i.monthlyFee),
    cardMode: i.cardMode,
    cardPrice: n(i.cardPrice),
    maxInstallments: i.maxInstallments,
    minMonths: i.minMonths,
  }));
}

// Orçamento já salvo usa as taxas congeladas no momento em que foi montado —
// mudar a maquininha depois nunca altera o que o cliente já recebeu.
export function quoteForProposal(p: DbProposal, fallback: PricingConfig): { quote: QuoteBreakdown; config: PricingConfig } {
  const config = p.pricingSnapshot ? normalizeConfig(p.pricingSnapshot as Partial<PricingConfig>) : fallback;
  const quote = computeQuote(toPricedItems(p.items), config, {
    discountPercent: Number(p.discountPercent),
    maxInstallments: p.maxInstallments,
    currency: p.currency,
  });
  return { quote, config };
}
