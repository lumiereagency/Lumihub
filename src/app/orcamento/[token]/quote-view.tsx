"use client";

import { useState, useTransition } from "react";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  FileSignature,
  MessageSquareText,
  PenLine,
  Sparkles,
  X,
} from "lucide-react";
import type {
  MonthlyChoice,
  OneTimeChoice,
  PaymentChoice,
  QuoteBreakdown,
} from "@/lib/pricing/engine";
import { respondToQuoteAction } from "@/lib/actions/public-quote-actions";
import { Logo } from "@/components/layout/logo";

interface QuoteItem {
  id: string;
  name: string;
  tagline: string | null;
  features: string[];
  billing: "MENSAL" | "PONTUAL";
  quantity: number;
  unitPrice: number;
  monthlyFee: number | null;
  terms: string | null;
  cardMode: "AUTO" | "FIXED" | "NONE";
  cardPrice: number | null;
  maxInstallments: number | null;
}

interface ProposalView {
  code: string;
  title: string;
  company: string | null;
  recipientName: string | null;
  sellerName: string | null;
  intro: string | null;
  validUntil: string | null;
  expired: boolean;
  status: string;
  response: "ACEITA" | "AJUSTE" | "RECUSADA" | null;
  responseMessage: string | null;
  chosenPayment: PaymentChoice | null;
  minMonths: number | null;
  currency: string;
  discountPercent: number;
  signatureLink: string | null;
  signed: boolean;
  items: QuoteItem[];
}

// Identidade do Guia Comercial: preto quente, dourado em gradiente, Poppins.
// A página tem um só tema de propósito (é uma peça da marca, não do app).
const THEME: CSSProperties = {
  ["--q-bg" as string]: "#0B0A08",
  ["--q-surface" as string]: "#13110D",
  ["--q-raised" as string]: "#1B1813",
  ["--q-line" as string]: "#2B261D",
  ["--q-text" as string]: "#F5F0E6",
  ["--q-muted" as string]: "#A69E8E",
  ["--q-faint" as string]: "#6F685B",
  ["--q-gold" as string]: "#D6B266",
  ["--q-gold-grad" as string]:
    "linear-gradient(120deg,#F6DDA0 0%,#D6B266 45%,#9E7B37 100%)",
  fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif",
  background: "#0B0A08",
  color: "#F5F0E6",
};

const goldText = "bg-[image:var(--q-gold-grad)] bg-clip-text text-transparent";

function fmt(value: number, currency: string): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function dateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--q-gold)]">
      <span className="h-px w-8 bg-[image:var(--q-gold-grad)]" />
      {children}
    </p>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  value,
  caption,
  pill,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  value: string;
  caption?: string;
  pill?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--q-gold)] disabled:cursor-default ${
        selected
          ? "border-[var(--q-gold)] bg-[var(--q-raised)]"
          : "border-[var(--q-line)] bg-[var(--q-surface)] hover:border-[#4A4132]"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-[var(--q-gold)]" : "border-[var(--q-faint)]"}`}
      >
        {selected && (
          <span className="h-2.5 w-2.5 rounded-full bg-[image:var(--q-gold-grad)]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--q-text)]">
          {title}
          {pill && (
            <span className="rounded-full bg-[image:var(--q-gold-grad)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1A1408]">
              {pill}
            </span>
          )}
        </span>
        {caption && (
          <span className="mt-0.5 block text-xs text-[var(--q-muted)]">
            {caption}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right text-base font-semibold tabular-nums text-[var(--q-text)]">
        {value}
      </span>
    </button>
  );
}

const field =
  "h-12 w-full rounded-xl border border-[var(--q-line)] bg-[var(--q-bg)] px-4 text-sm text-[var(--q-text)] placeholder:text-[var(--q-faint)] focus:border-[var(--q-gold)] focus:outline-none";

export function QuoteView({
  token,
  isTeamPreview,
  proposal,
  quote,
  pixKey,
  companyName,
}: {
  token: string;
  isTeamPreview: boolean;
  proposal: ProposalView;
  quote: QuoteBreakdown;
  pixKey: string | null;
  companyName: string;
}) {
  const c = proposal.currency;
  const money = (v: number) => fmt(v, c);
  const firstName = proposal.recipientName?.split(" ")[0] ?? null;
  const expired = proposal.expired;
  const accepted = proposal.status === "ACEITA";

  const credit = quote.oneTime?.credit ?? [];
  const [oneTime, setOneTime] = useState<OneTimeChoice | null>(
    proposal.chosenPayment?.oneTime ?? (quote.oneTime ? "PIX" : null),
  );
  const [installments, setInstallments] = useState<number>(() => {
    const m = /^CREDITO_(\d+)X$/.exec(proposal.chosenPayment?.oneTime ?? "");
    return m ? Number(m[1]) : (credit.at(-1)?.n ?? 1);
  });
  const [monthly, setMonthly] = useState<MonthlyChoice | null>(
    proposal.chosenPayment?.monthly ?? (quote.monthly ? "PIX" : null),
  );
  const [mode, setMode] = useState<"idle" | "accept" | "adjust" | "refuse">(
    "idle",
  );
  // Palpite inicial: se o "nome da empresa" é o próprio nome de quem recebe,
  // é pessoa física. O cliente troca com um toque.
  const [personType, setPersonType] = useState<"PF" | "PJ">(() => {
    const norm = (v: string | null) => (v ?? "").trim().toLowerCase();
    return !proposal.company ||
      norm(proposal.company) === norm(proposal.recipientName)
      ? "PF"
      : "PJ";
  });
  const [done, setDone] = useState<"ACEITA" | "AJUSTE" | "RECUSADA" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedCredit =
    credit.find((o) => o.n === installments) ?? credit.at(-1);
  const isCredit = oneTime?.startsWith("CREDITO_") ?? false;

  const summary: { label: string; value: string }[] = [];
  {
    const lines = summary;
    if (quote.oneTime) {
      const o = quote.oneTime;
      if (oneTime === "PIX")
        lines.push({ label: "Projeto no Pix", value: money(o.pix) });
      else if (oneTime === "DEBITO" && o.debit != null)
        lines.push({
          label: "Projeto no débito",
          value: money(o.debit + o.pixOnly),
        });
      else if (isCredit && selectedCredit)
        lines.push({
          label: "Projeto no cartão",
          value:
            selectedCredit.n === 1
              ? money(selectedCredit.total)
              : `${selectedCredit.n}x de ${money(selectedCredit.installment)}`,
        });
    }
    if (quote.monthly) {
      const m = quote.monthly;
      lines.push({
        label: "Mensalidade",
        value: `${money(monthly === "CARTAO" && m.card != null ? m.card + m.pixOnly : m.pix)}/mês`,
      });
    }
  }

  function choice(): PaymentChoice {
    return {
      oneTime: quote.oneTime
        ? isCredit && selectedCredit
          ? (`CREDITO_${selectedCredit.n}X` as OneTimeChoice)
          : oneTime
        : null,
      monthly: quote.monthly ? monthly : null,
    };
  }

  function submitAccept(formData: FormData) {
    const text = (k: string) => String(formData.get(k) ?? "");
    const day = Number(formData.get("paymentDay"));
    startTransition(async () => {
      const result = await respondToQuoteAction(token, {
        response: "ACEITA",
        choice: choice(),
        message: text("message"),
        signer: {
          personType,
          name: text("name"),
          document: text("document"),
          representative:
            personType === "PJ" ? text("representative") : undefined,
          representativeDoc:
            personType === "PJ" ? text("representativeDoc") : undefined,
          email: text("email"),
          phone: text("phone"),
          address: text("address"),
          paymentDay: quote.monthly && day ? day : null,
        },
      });
      if (!result.ok) return setError(result.error);
      setError(null);
      setDone("ACEITA");
      setMode("idle");
    });
  }

  function submitOther(kind: "AJUSTE" | "RECUSADA", formData: FormData) {
    startTransition(async () => {
      const result = await respondToQuoteAction(token, {
        response: kind,
        message: String(formData.get("message") ?? ""),
      });
      if (!result.ok) return setError(result.error);
      setError(null);
      setDone(kind);
      setMode("idle");
    });
  }

  const finalState =
    done ??
    (accepted
      ? "ACEITA"
      : proposal.response === "RECUSADA"
        ? "RECUSADA"
        : proposal.response === "AJUSTE"
          ? "AJUSTE"
          : null);
  const canAccept = !accepted && !expired && finalState !== "ACEITA";

  return (
    <div
      style={THEME}
      className="min-h-screen pb-28 antialiased selection:bg-[#D6B266]/30 sm:pb-16"
    >
      {isTeamPreview && (
        <div className="bg-[var(--q-raised)] px-4 py-2 text-center text-xs text-[var(--q-muted)]">
          Pré-visualização da equipe — suas visitas não contam como visualização
          do cliente.
        </div>
      )}

      <div className="mx-auto flex max-w-[760px] flex-col gap-14 px-5 pt-8 sm:px-8 sm:pt-12">
        {/* Topo */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="md" gradientId="q-mark" className="h-6 w-9" />
            <span
              className={`text-lg font-semibold tracking-[0.32em] ${goldText}`}
            >
              LUMI
            </span>
          </div>
          <div className="text-right text-[11px] uppercase tracking-[0.18em] text-[var(--q-faint)]">
            <p>Orçamento nº {proposal.code}</p>
            {proposal.validUntil && (
              <p className={expired ? "text-[#E0896B]" : ""}>
                {expired
                  ? "Validade encerrada"
                  : `Válido até ${dateBR(proposal.validUntil)}`}
              </p>
            )}
          </div>
        </header>

        {/* Abertura */}
        <section className="flex flex-col gap-6">
          <Eyebrow>Orçamento personalizado</Eyebrow>
          <h1 className="text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[56px]">
            {firstName ? (
              <>
                Olá, <span className={goldText}>{firstName}</span>.
              </>
            ) : (
              <span className={goldText}>{proposal.title}</span>
            )}
          </h1>
          <p className="max-w-[560px] text-lg font-light leading-relaxed text-[var(--q-muted)]">
            Preparamos {firstName ? "este" : "o"} orçamento de{" "}
            <span className="text-[var(--q-text)]">{proposal.title}</span>
            {proposal.company &&
              proposal.company.trim().toLowerCase() !==
                (proposal.recipientName ?? "").trim().toLowerCase() && (
                <>
                  {" "}
                  para{" "}
                  <span className="text-[var(--q-text)]">
                    {proposal.company}
                  </span>
                </>
              )}
            . Aqui está tudo o que está incluso, as formas de pagamento e onde
            você pode responder.
          </p>
          {proposal.intro && (
            <figure className="rounded-3xl border border-[var(--q-line)] bg-[var(--q-surface)] p-6">
              <blockquote className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--q-text)]">
                {proposal.intro}
              </blockquote>
              {proposal.sellerName && (
                <figcaption className="mt-4 text-xs uppercase tracking-[0.2em] text-[var(--q-gold)]">
                  {proposal.sellerName} · Lumière
                </figcaption>
              )}
            </figure>
          )}
        </section>

        {/* Itens */}
        <section className="flex flex-col gap-5">
          <Eyebrow>O que está incluso</Eyebrow>
          <div className="flex flex-col gap-3">
            {proposal.items.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-[var(--q-line)] bg-[var(--q-surface)] p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight">
                      {item.name}
                    </h2>
                    {item.tagline && (
                      <p className="mt-1 text-sm text-[var(--q-muted)]">
                        {item.tagline}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="text-xl font-semibold tabular-nums">
                      {item.quantity > 1 && (
                        <span className="mr-1 text-sm font-normal text-[var(--q-muted)]">
                          {item.quantity} ×
                        </span>
                      )}
                      {money(item.unitPrice)}
                      {item.billing === "MENSAL" && (
                        <span className="text-sm font-normal text-[var(--q-muted)]">
                          /mês
                        </span>
                      )}
                    </p>
                    {item.monthlyFee ? (
                      <p className="text-xs text-[var(--q-muted)]">
                        + {money(item.monthlyFee)}/mês de hospedagem e
                        manutenção
                      </p>
                    ) : null}
                    {item.cardMode === "FIXED" &&
                      item.cardPrice &&
                      c === "BRL" && (
                        <p className="text-xs text-[var(--q-muted)]">
                          ou {money(item.cardPrice)} em até{" "}
                          {item.maxInstallments ?? 1}x sem juros
                        </p>
                      )}
                  </div>
                </div>
                {item.features.length > 0 && (
                  <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2.5 border-t border-[var(--q-line)] pt-5 sm:grid-cols-2">
                    {item.features.map((f) => (
                      <li
                        key={f}
                        className="flex gap-2.5 text-sm text-[var(--q-text)]/90"
                      >
                        <Check
                          size={16}
                          className="mt-0.5 shrink-0 text-[var(--q-gold)]"
                          strokeWidth={2.2}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                {item.terms && (
                  <p className="mt-4 text-xs leading-relaxed text-[var(--q-faint)]">
                    {item.terms}
                  </p>
                )}
              </article>
            ))}
          </div>
          {proposal.discountPercent > 0 && (
            <p className="flex items-center gap-2 text-sm text-[var(--q-gold)]">
              <Sparkles size={15} /> Condição especial:{" "}
              {proposal.discountPercent.toLocaleString("pt-BR")}% de desconto já
              aplicado nos valores abaixo.
            </p>
          )}
        </section>

        {/* Investimento */}
        <section className="flex flex-col gap-6">
          <Eyebrow>Investimento</Eyebrow>

          {quote.monthly && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 className="text-sm font-medium text-[var(--q-muted)]">
                  Mensalidade
                </h3>
                {quote.minMonths && (
                  <p className="text-xs text-[var(--q-faint)]">
                    Contrato mínimo de {quote.minMonths} meses
                  </p>
                )}
              </div>
              <div
                role="radiogroup"
                aria-label="Forma de pagamento da mensalidade"
                className="flex flex-col gap-2"
              >
                <OptionCard
                  selected={monthly === "PIX"}
                  onSelect={() => setMonthly("PIX")}
                  disabled={!canAccept}
                  title="Pix todo mês"
                  pill="Melhor valor"
                  value={`${money(quote.monthly.pix)}/mês`}
                />
                {quote.monthly.card != null && (
                  <OptionCard
                    selected={monthly === "CARTAO"}
                    onSelect={() => setMonthly("CARTAO")}
                    disabled={!canAccept}
                    title="Cartão de crédito todo mês"
                    caption={
                      quote.monthly.pixOnly
                        ? `+ ${money(quote.monthly.pixOnly)}/mês no Pix (itens sem cartão)`
                        : undefined
                    }
                    value={`${money(quote.monthly.card + quote.monthly.pixOnly)}/mês`}
                  />
                )}
              </div>
            </div>
          )}

          {quote.oneTime && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-[var(--q-muted)]">
                {quote.monthly ? "Projeto (pagamento único)" : "Pagamento"}
              </h3>
              <div
                role="radiogroup"
                aria-label="Forma de pagamento do projeto"
                className="flex flex-col gap-2"
              >
                <OptionCard
                  selected={oneTime === "PIX"}
                  onSelect={() => setOneTime("PIX")}
                  disabled={!canAccept}
                  title={c === "BRL" ? "À vista no Pix" : "À vista"}
                  pill="Melhor valor"
                  caption={
                    c === "BRL" ? undefined : "50% na entrada e 50% na entrega"
                  }
                  value={money(quote.oneTime.pix)}
                />
                {quote.oneTime.debit != null && (
                  <OptionCard
                    selected={oneTime === "DEBITO"}
                    onSelect={() => setOneTime("DEBITO")}
                    disabled={!canAccept}
                    title="Cartão de débito"
                    caption={
                      quote.oneTime.pixOnly
                        ? `+ ${money(quote.oneTime.pixOnly)} no Pix (itens sem cartão)`
                        : undefined
                    }
                    value={money(quote.oneTime.debit + quote.oneTime.pixOnly)}
                  />
                )}
                {credit.length > 0 && selectedCredit && (
                  <div
                    className={`rounded-2xl border transition-colors ${isCredit ? "border-[var(--q-gold)] bg-[var(--q-raised)]" : "border-[var(--q-line)] bg-[var(--q-surface)]"}`}
                  >
                    <OptionCard
                      selected={isCredit}
                      onSelect={() =>
                        setOneTime(`CREDITO_${selectedCredit.n}X`)
                      }
                      disabled={!canAccept}
                      title="Cartão de crédito"
                      caption={
                        selectedCredit.n > 1
                          ? `Total de ${money(selectedCredit.total)}`
                          : undefined
                      }
                      value={
                        selectedCredit.n === 1
                          ? money(selectedCredit.total)
                          : `${selectedCredit.n}x de ${money(selectedCredit.installment)}`
                      }
                    />
                    {isCredit && credit.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                        {credit.map((o) => (
                          <button
                            key={o.n}
                            type="button"
                            disabled={!canAccept}
                            onClick={() => {
                              setInstallments(o.n);
                              setOneTime(`CREDITO_${o.n}X`);
                            }}
                            aria-pressed={o.n === selectedCredit.n}
                            className={`h-9 rounded-full px-3 text-xs font-medium tabular-nums transition-colors ${
                              o.n === selectedCredit.n
                                ? "bg-[image:var(--q-gold-grad)] text-[#1A1408]"
                                : "border border-[var(--q-line)] text-[var(--q-muted)] hover:text-[var(--q-text)]"
                            }`}
                          >
                            {o.n}x {money(o.installment)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {quote.oneTime.pixOnly > 0 && quote.oneTime.debit != null && (
                <p className="text-xs text-[var(--q-faint)]">
                  Alguns itens são só à vista no Pix (
                  {money(quote.oneTime.pixOnly)}).
                </p>
              )}
            </div>
          )}
        </section>

        {/* Resposta */}
        <section id="responder" className="flex flex-col gap-5 scroll-mt-6">
          <Eyebrow>
            {finalState === "ACEITA" ? "Próximos passos" : "Sua resposta"}
          </Eyebrow>

          {finalState === "ACEITA" ? (
            <div className="flex flex-col gap-6 rounded-3xl border border-[var(--q-gold)]/50 bg-[var(--q-surface)] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[image:var(--q-gold-grad)] text-[#1A1408]">
                  <Check size={22} strokeWidth={2.6} />
                </span>
                <div>
                  <p className="text-xl font-semibold">
                    Orçamento aceito{firstName ? `, ${firstName}` : ""}!
                  </p>
                  <p className="text-sm text-[var(--q-muted)]">
                    Que bom ter você com a gente.
                  </p>
                </div>
              </div>
              <ol className="flex flex-col gap-4">
                {[
                  {
                    icon: <FileSignature size={17} />,
                    title: proposal.signed
                      ? "Contrato assinado"
                      : "Contrato digital",
                    text: proposal.signed
                      ? "Tudo certo com a assinatura. Obrigado!"
                      : "Você recebe o contrato pelo WhatsApp para assinar pelo Autentique, com validade jurídica, em poucos minutos.",
                  },
                  {
                    icon: <Clock size={17} />,
                    title: "Pagamento",
                    text:
                      pixKey &&
                      (proposal.chosenPayment?.oneTime === "PIX" ||
                        proposal.chosenPayment?.monthly === "PIX" ||
                        oneTime === "PIX")
                        ? `Chave Pix: ${pixKey}. Envie o comprovante para a gente no WhatsApp.`
                        : "Combinamos o pagamento na forma que você escolheu assim que o contrato for assinado.",
                  },
                  {
                    icon: <Sparkles size={17} />,
                    title: "Início",
                    text: "Agendamos o briefing e começamos a produção.",
                  },
                ].map((step) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--q-line)] text-[var(--q-gold)]">
                      {step.icon}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-sm text-[var(--q-muted)]">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {proposal.signatureLink && (
                <a
                  href={proposal.signatureLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[image:var(--q-gold-grad)] px-6 text-sm font-semibold text-[#1A1408]"
                >
                  <PenLine size={16} /> Assinar contrato agora
                </a>
              )}
            </div>
          ) : (
            <>
              {finalState === "AJUSTE" && mode === "idle" && (
                <p className="rounded-2xl border border-[var(--q-line)] bg-[var(--q-surface)] px-5 py-4 text-sm text-[var(--q-muted)]">
                  Recebemos seu pedido de ajuste e já estamos revisando. Você
                  recebe a nova versão por aqui mesmo.
                </p>
              )}
              {finalState === "RECUSADA" && mode === "idle" && (
                <p className="rounded-2xl border border-[var(--q-line)] bg-[var(--q-surface)] px-5 py-4 text-sm text-[var(--q-muted)]">
                  Obrigado pela resposta! Se mudar de ideia, é só aceitar ou
                  pedir um ajuste por aqui.
                </p>
              )}
              {expired && (
                <p className="rounded-2xl border border-[#E0896B]/40 px-5 py-4 text-sm text-[#E8A48C]">
                  A validade deste orçamento terminou. Peça um ajuste para
                  receber os valores atualizados.
                </p>
              )}

              {summary.length > 0 && mode !== "accept" && (
                <dl className="flex flex-col gap-2 rounded-2xl bg-[var(--q-surface)] px-5 py-4">
                  {summary.map((l) => (
                    <div
                      key={l.label}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <dt className="text-[var(--q-muted)]">{l.label}</dt>
                      <dd className="font-semibold tabular-nums">{l.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {mode === "idle" && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {canAccept && (
                    <button
                      type="button"
                      onClick={() => setMode("accept")}
                      className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[image:var(--q-gold-grad)] px-6 text-[15px] font-semibold text-[#1A1408] transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--q-text)]"
                    >
                      Aceitar orçamento <ArrowRight size={18} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMode("adjust")}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-[var(--q-line)] px-6 text-sm font-medium text-[var(--q-text)] hover:border-[var(--q-gold)]"
                  >
                    <MessageSquareText size={16} /> Quero ajustar
                  </button>
                  {finalState !== "RECUSADA" && (
                    <button
                      type="button"
                      onClick={() => setMode("refuse")}
                      className="h-14 px-4 text-sm text-[var(--q-faint)] hover:text-[var(--q-muted)]"
                    >
                      Agora não
                    </button>
                  )}
                </div>
              )}

              {mode === "accept" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitAccept(new FormData(e.currentTarget));
                  }}
                  className="flex flex-col gap-4 rounded-3xl border border-[var(--q-line)] bg-[var(--q-surface)] p-5 sm:p-7"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">
                        Dados para o contrato
                      </p>
                      <p className="text-sm text-[var(--q-muted)]">
                        Usamos só para preparar o seu contrato e a assinatura
                        digital.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMode("idle")}
                      aria-label="Fechar"
                      className="rounded-full p-2 text-[var(--q-faint)] hover:text-[var(--q-text)]"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <dl className="flex flex-col gap-1.5 rounded-2xl bg-[var(--q-bg)] px-4 py-3">
                    {summary.map((l) => (
                      <div
                        key={l.label}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <dt className="text-[var(--q-muted)]">{l.label}</dt>
                        <dd className="font-semibold tabular-nums">
                          {l.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div
                    role="radiogroup"
                    aria-label="Quem contrata"
                    className="grid grid-cols-2 gap-1 rounded-full border border-[var(--q-line)] p-1"
                  >
                    {(
                      [
                        ["PF", "Pessoa física"],
                        ["PJ", "Empresa"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={personType === key}
                        onClick={() => setPersonType(key)}
                        className={`h-10 rounded-full text-sm font-medium transition-colors ${
                          personType === key
                            ? "bg-[image:var(--q-gold-grad)] text-[#1A1408]"
                            : "text-[var(--q-muted)] hover:text-[var(--q-text)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div
                    key={personType}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                  >
                    <label className="flex flex-col gap-1.5 text-xs text-[var(--q-muted)] sm:col-span-2">
                      {personType === "PF" ? "Nome completo" : "Razão social"}
                      <input
                        name="name"
                        required
                        autoComplete={
                          personType === "PF" ? "name" : "organization"
                        }
                        className={field}
                        defaultValue={
                          personType === "PF"
                            ? (proposal.recipientName ?? proposal.company ?? "")
                            : (proposal.company ?? "")
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs text-[var(--q-muted)]">
                      {personType === "PF" ? "CPF" : "CNPJ"}
                      <input
                        name="document"
                        required
                        inputMode="numeric"
                        className={field}
                        placeholder={
                          personType === "PF"
                            ? "000.000.000-00"
                            : "00.000.000/0000-00"
                        }
                      />
                    </label>
                    {personType === "PJ" && (
                      <>
                        <label className="flex flex-col gap-1.5 text-xs text-[var(--q-muted)]">
                          Quem assina pela empresa
                          <input
                            name="representative"
                            required
                            autoComplete="name"
                            className={field}
                            defaultValue={proposal.recipientName ?? ""}
                          />
                        </label>
                        <label className="flex flex-col gap-1.5 text-xs text-[var(--q-muted)]">
                          CPF de quem assina (opcional)
                          <input
                            name="representativeDoc"
                            inputMode="numeric"
                            className={field}
                            placeholder="000.000.000-00"
                          />
                        </label>
                      </>
                    )}
                    <label className="flex flex-col gap-1.5 text-xs text-[var(--q-muted)]">
                      E-mail
                      <input
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        className={field}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs text-[var(--q-muted)]">
                      WhatsApp
                      <input
                        name="phone"
                        required
                        inputMode="tel"
                        autoComplete="tel"
                        className={field}
                        placeholder="(00) 00000-0000"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs text-[var(--q-muted)] sm:col-span-2">
                      Endereço completo
                      <input
                        name="address"
                        required
                        autoComplete="street-address"
                        className={field}
                        placeholder="Rua, número, bairro, cidade/UF, CEP"
                      />
                    </label>
                    {quote.monthly && (
                      <label className="flex flex-col gap-1.5 text-xs text-[var(--q-muted)]">
                        Melhor dia para a mensalidade
                        <select
                          name="paymentDay"
                          defaultValue="10"
                          className={field}
                        >
                          {[5, 10, 15, 20, 25].map((d) => (
                            <option key={d} value={d}>
                              Dia {d}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="flex flex-col gap-1.5 text-xs text-[var(--q-muted)] sm:col-span-2">
                      Algum recado? (opcional)
                      <textarea
                        name="message"
                        rows={2}
                        className={`${field} h-auto resize-none py-3`}
                      />
                    </label>
                  </div>
                  {error && (
                    <p className="rounded-xl bg-[#E0896B]/10 px-4 py-3 text-sm text-[#E8A48C]">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[image:var(--q-gold-grad)] text-[15px] font-semibold text-[#1A1408] disabled:opacity-60"
                  >
                    {pending ? "Enviando…" : "Confirmar e aceitar"}
                  </button>
                  <p className="text-center text-[11px] text-[var(--q-faint)]">
                    Ao confirmar, você aceita este orçamento. O contrato chega
                    para assinatura digital em seguida.
                  </p>
                </form>
              )}

              {(mode === "adjust" || mode === "refuse") && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitOther(
                      mode === "adjust" ? "AJUSTE" : "RECUSADA",
                      new FormData(e.currentTarget),
                    );
                  }}
                  className="flex flex-col gap-4 rounded-3xl border border-[var(--q-line)] bg-[var(--q-surface)] p-5 sm:p-7"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-semibold">
                      {mode === "adjust"
                        ? "O que você gostaria de ajustar?"
                        : "Tudo bem! Pode contar o motivo?"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode("idle")}
                      aria-label="Fechar"
                      className="rounded-full p-2 text-[var(--q-faint)] hover:text-[var(--q-text)]"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <textarea
                    name="message"
                    rows={4}
                    required={mode === "adjust"}
                    autoFocus
                    className={`${field} h-auto resize-none py-3`}
                    placeholder={
                      mode === "adjust"
                        ? "Ex: queria 4 vídeos em vez de 8, ou pagar em mais vezes…"
                        : "Opcional — ajuda a gente a melhorar."
                    }
                  />
                  {error && (
                    <p className="rounded-xl bg-[#E0896B]/10 px-4 py-3 text-sm text-[#E8A48C]">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--q-gold)] text-sm font-semibold text-[var(--q-text)] disabled:opacity-60"
                  >
                    {pending
                      ? "Enviando…"
                      : mode === "adjust"
                        ? "Enviar pedido de ajuste"
                        : "Enviar resposta"}
                  </button>
                </form>
              )}
            </>
          )}
        </section>

        <footer className="flex flex-col items-center gap-3 border-t border-[var(--q-line)] pt-8 pb-4 text-center">
          <Logo size="sm" gradientId="q-mark-foot" className="h-5 w-[30px] opacity-80" />
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--q-faint)]">
            LUMI · {companyName}
          </p>
        </footer>
      </div>

      {/* Barra fixa no celular para não perder o botão de aceitar */}
      {canAccept && mode === "idle" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--q-line)] bg-[#0B0A08]/95 px-5 py-3 backdrop-blur sm:hidden">
          <a
            href="#responder"
            onClick={() => setMode("accept")}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-[image:var(--q-gold-grad)] text-sm font-semibold text-[#1A1408]"
          >
            Aceitar orçamento <ArrowRight size={16} />
          </a>
        </div>
      )}
    </div>
  );
}
