// Motor de preços dos orçamentos — puro (sem banco), usado igual no montador,
// na página pública do cliente e no servidor, para os três sempre mostrarem
// os mesmos números.
//
// Regra combinada com a diretoria: Pix é o preço de tabela. No cartão, todas
// as taxas da maquininha são repassadas ao cliente e, no crédito, ainda entra
// uma margem extra (configurável) — para o valor líquido recebido no crédito
// ficar um pouco acima do Pix. Parcelas sempre arredondadas para cima em
// reais inteiros.

export interface FeeRow {
  n: number;
  // Taxa por venda paga pela empresa (%).
  seller: number;
  // Taxa de parcelamento paga pelo cliente (%), já embutida pela maquininha.
  buyer: number;
}

export interface PricingConfig {
  debitFee: number;
  rows: FeeRow[];
  creditMargin: number;
  maxInstallments: number;
}

// Tabela da maquininha da Lumière (setembro/2026).
export const DEFAULT_FEE_ROWS: FeeRow[] = [
  { n: 1, seller: 2.84, buyer: 0 },
  { n: 2, seller: 2.85, buyer: 9.64 },
  { n: 3, seller: 2.85, buyer: 11.23 },
  { n: 4, seller: 2.85, buyer: 11.36 },
  { n: 5, seller: 2.85, buyer: 14.31 },
  { n: 6, seller: 2.85, buyer: 14.32 },
  { n: 7, seller: 2.69, buyer: 16.72 },
  { n: 8, seller: 2.69, buyer: 16.73 },
  { n: 9, seller: 2.69, buyer: 19.69 },
  { n: 10, seller: 2.69, buyer: 20.65 },
  { n: 11, seller: 2.69, buyer: 20.66 },
  { n: 12, seller: 2.69, buyer: 22.11 },
  { n: 13, seller: 3.14, buyer: 23.04 },
  { n: 14, seller: 3.14, buyer: 24.45 },
  { n: 15, seller: 3.14, buyer: 25.83 },
  { n: 16, seller: 3.14, buyer: 27.2 },
  { n: 17, seller: 3.14, buyer: 28.58 },
  { n: 18, seller: 3.14, buyer: 29.99 },
];

export const DEFAULT_PRICING: PricingConfig = {
  debitFee: 0.94,
  rows: DEFAULT_FEE_ROWS,
  creditMargin: 5,
  maxInstallments: 12,
};

export type Billing = "MENSAL" | "PONTUAL";
export type CardMode = "AUTO" | "FIXED" | "NONE";

export interface PricedItem {
  billing: Billing;
  quantity: number;
  unitPrice: number;
  monthlyFee?: number | null;
  cardMode: CardMode;
  cardPrice?: number | null;
  maxInstallments?: number | null;
  minMonths?: number | null;
}

export interface InstallmentOption {
  n: number;
  installment: number;
  total: number;
  // Valor a digitar na maquininha (modo "parcelado cliente") e o líquido que cai na conta.
  machine: number;
  net: number;
}

export interface QuoteBreakdown {
  currency: string;
  discountPercent: number;
  oneTime: {
    pix: number;
    // Parte que só pode ser paga à vista no Pix (serviços sem parcelamento).
    pixOnly: number;
    debit: number | null;
    debitNet: number | null;
    credit: InstallmentOption[];
  } | null;
  monthly: {
    pix: number;
    pixOnly: number;
    card: number | null;
    cardNet: number | null;
  } | null;
  minMonths: number | null;
  contractValue: number;
}

const EPS = 1e-6;
const ceilReal = (v: number) => Math.ceil(v - EPS);
const ceilCents = (v: number) => Math.ceil(v * 100 - EPS) / 100;
const round2 = (v: number) => Math.round(v * 100) / 100;

function feeRow(cfg: PricingConfig, n: number): FeeRow {
  return cfg.rows.find((r) => r.n === n) ?? { n, seller: 0, buyer: 0 };
}

export function normalizeConfig(raw: Partial<PricingConfig> | null | undefined): PricingConfig {
  const rows = Array.isArray(raw?.rows) && raw.rows.length ? raw.rows : DEFAULT_FEE_ROWS;
  return {
    debitFee: Number(raw?.debitFee ?? DEFAULT_PRICING.debitFee),
    rows: rows
      .map((r) => ({ n: Number(r.n), seller: Number(r.seller) || 0, buyer: Number(r.buyer) || 0 }))
      .filter((r) => r.n >= 1 && r.n <= 24)
      .sort((a, b) => a.n - b.n),
    creditMargin: Number(raw?.creditMargin ?? DEFAULT_PRICING.creditMargin),
    maxInstallments: Number(raw?.maxInstallments ?? DEFAULT_PRICING.maxInstallments),
  };
}

// Débito: só repassa a taxa (é praticamente à vista).
export function debitFor(base: number, cfg: PricingConfig): { total: number; net: number } {
  if (base <= 0) return { total: 0, net: 0 };
  const total = ceilReal(base / (1 - cfg.debitFee / 100));
  return { total, net: round2(total * (1 - cfg.debitFee / 100)) };
}

// Crédito em N vezes para a parte "automática" (repasse de taxas + margem).
export function creditFor(base: number, n: number, cfg: PricingConfig): { total: number; machine: number } {
  if (base <= 0) return { total: 0, machine: 0 };
  const row = feeRow(cfg, n);
  const machine = (base * (1 + cfg.creditMargin / 100)) / (1 - row.seller / 100);
  if (n === 1) {
    const total = ceilReal(machine);
    return { total, machine: total };
  }
  const total = ceilReal((machine * (1 + row.buyer / 100)) / n) * n;
  return { total, machine: ceilCents(total / (1 + row.buyer / 100)) };
}

function lineTotal(item: PricedItem, discount: number): number {
  return item.quantity * item.unitPrice * (1 - discount / 100);
}

export function computeQuote(
  items: PricedItem[],
  cfg: PricingConfig,
  opts: { discountPercent?: number; maxInstallments?: number | null; currency?: string } = {},
): QuoteBreakdown {
  const currency = opts.currency ?? "BRL";
  const discount = Math.min(Math.max(opts.discountPercent ?? 0, 0), 100);
  const cardAllowed = currency === "BRL";

  const oneTimeItems = items.filter((i) => i.billing === "PONTUAL");
  const monthlyItems = items.filter((i) => i.billing === "MENSAL");

  // ---------- Pontual ----------
  let oneTime: QuoteBreakdown["oneTime"] = null;
  if (oneTimeItems.length) {
    const pix = oneTimeItems.reduce((s, i) => s + lineTotal(i, discount), 0);
    const pixOnly = oneTimeItems.filter((i) => i.cardMode === "NONE" || !cardAllowed).reduce((s, i) => s + lineTotal(i, discount), 0);
    const autoBase = oneTimeItems.filter((i) => i.cardMode === "AUTO").reduce((s, i) => s + lineTotal(i, discount), 0);
    const fixedItems = oneTimeItems.filter((i) => i.cardMode === "FIXED");
    const fixedCard = fixedItems.reduce((s, i) => s + i.quantity * (i.cardPrice ?? i.unitPrice) * (1 - discount / 100), 0);
    const fixedPix = fixedItems.reduce((s, i) => s + lineTotal(i, discount), 0);
    const cardBase = autoBase + fixedPix;

    let debit: number | null = null;
    let debitNet: number | null = null;
    const credit: InstallmentOption[] = [];

    if (cardAllowed && cardBase > 0) {
      const d = debitFor(cardBase, cfg);
      debit = d.total;
      debitNet = d.net;

      const limits = [cfg.maxInstallments, opts.maxInstallments ?? Infinity];
      for (const i of oneTimeItems) if (i.cardMode !== "NONE" && i.maxInstallments) limits.push(i.maxInstallments);
      const maxN = Math.max(1, Math.min(...limits, cfg.rows.length ? Math.max(...cfg.rows.map((r) => r.n)) : 1));

      for (let n = 1; n <= maxN; n++) {
        const auto = creditFor(autoBase, n, cfg);
        const row = feeRow(cfg, n);
        const total = auto.total + fixedCard;
        const installment = ceilCents(total / n);
        const machine = n === 1 ? total : ceilCents((installment * n) / (1 + row.buyer / 100));
        credit.push({ n, installment, total: round2(installment * n), machine, net: round2(machine * (1 - row.seller / 100)) });
      }
    }

    oneTime = { pix: round2(pix), pixOnly: round2(pixOnly), debit, debitNet, credit };
  }

  // ---------- Mensal (inclui mensalidades de itens pontuais, ex: manutenção do site) ----------
  const monthlyParts: { amount: number; mode: CardMode; card?: number | null }[] = [
    ...monthlyItems.map((i) => ({
      amount: lineTotal(i, discount),
      mode: i.cardMode,
      card: i.cardMode === "FIXED" ? i.quantity * (i.cardPrice ?? i.unitPrice) * (1 - discount / 100) : null,
    })),
    ...oneTimeItems.filter((i) => (i.monthlyFee ?? 0) > 0).map((i) => ({ amount: i.quantity * (i.monthlyFee ?? 0), mode: "AUTO" as CardMode })),
  ];

  let monthly: QuoteBreakdown["monthly"] = null;
  if (monthlyParts.length) {
    const pix = monthlyParts.reduce((s, p) => s + p.amount, 0);
    const pixOnly = monthlyParts.filter((p) => p.mode === "NONE" || !cardAllowed).reduce((s, p) => s + p.amount, 0);
    let card: number | null = null;
    let cardNet: number | null = null;
    if (cardAllowed && pix - pixOnly > 0) {
      const autoBase = monthlyParts.filter((p) => p.mode === "AUTO").reduce((s, p) => s + p.amount, 0);
      const fixed = monthlyParts.filter((p) => p.mode === "FIXED").reduce((s, p) => s + (p.card ?? p.amount), 0);
      card = round2(creditFor(autoBase, 1, cfg).total + fixed);
      cardNet = round2(card * (1 - feeRow(cfg, 1).seller / 100));
    }
    monthly = { pix: round2(pix), pixOnly: round2(pixOnly), card, cardNet };
  }

  const minMonthsList = items.map((i) => i.minMonths ?? 0).filter((m) => m > 0);
  const minMonths = minMonthsList.length ? Math.max(...minMonthsList) : null;
  const contractValue = round2((oneTime?.pix ?? 0) + (monthly?.pix ?? 0) * Math.max(minMonths ?? 1, 1));

  return { currency, discountPercent: discount, oneTime, monthly, minMonths, contractValue };
}

// ---------- Escolha de pagamento do cliente ----------

export type OneTimeChoice = "PIX" | "DEBITO" | `CREDITO_${number}X`;
export type MonthlyChoice = "PIX" | "CARTAO";

export interface PaymentChoice {
  oneTime?: OneTimeChoice | null;
  monthly?: MonthlyChoice | null;
}

export function describeChoice(choice: PaymentChoice | null | undefined, quote: QuoteBreakdown, fmt: (v: number) => string): string[] {
  if (!choice) return [];
  const lines: string[] = [];
  if (choice.oneTime && quote.oneTime) {
    const o = quote.oneTime;
    if (choice.oneTime === "PIX") lines.push(`À vista no Pix: ${fmt(o.pix)}`);
    else if (choice.oneTime === "DEBITO" && o.debit != null) lines.push(`Débito: ${fmt(o.debit + o.pixOnly)}${o.pixOnly ? ` (${fmt(o.pixOnly)} no Pix)` : ""}`);
    else {
      const n = Number(/^CREDITO_(\d+)X$/.exec(choice.oneTime)?.[1] ?? 0);
      const opt = o.credit.find((c) => c.n === n);
      if (opt) lines.push(`Cartão de crédito: ${n === 1 ? `1x de ${fmt(opt.total)}` : `${n}x de ${fmt(opt.installment)} (total ${fmt(opt.total)})`}${o.pixOnly ? ` + ${fmt(o.pixOnly)} no Pix` : ""}`);
    }
  }
  if (choice.monthly && quote.monthly) {
    const m = quote.monthly;
    if (choice.monthly === "PIX") lines.push(`Mensalidade no Pix: ${fmt(m.pix)}/mês`);
    else if (m.card != null) lines.push(`Mensalidade no cartão: ${fmt(m.card)}/mês${m.pixOnly ? ` + ${fmt(m.pixOnly)}/mês no Pix` : ""}`);
  }
  return lines;
}

export function parseChoice(raw: string | null | undefined): PaymentChoice | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as PaymentChoice;
    return typeof v === "object" && v ? v : null;
  } catch {
    return null;
  }
}
