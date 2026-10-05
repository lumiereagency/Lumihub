"use client";

import { useState } from "react";
import { ArrowUpRight, Camera, ChevronLeft, ChevronRight, Clock, HandCoins, Sparkles, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface MyMonth {
  comp: string;
  label: string;
  total: number;
  fixed: number;
  commissionsTotal: number;
  extrasTotal: number;
  status: "PENDENTE" | "PAGO" | "ATRASADO" | "SEM_VALOR";
  dueDate: string | null;
  paidAt: string | null;
  payRule: string;
  items: { kind: "c" | "e"; text: string; amount: number; date: string | null }[];
}

const TZ = "America/Sao_Paulo";
const dateBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: TZ });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
const monthShort = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function statusLine(m: MyMonth, isCurrent: boolean): string {
  if (m.status === "PAGO") return `Recebido${m.paidAt ? ` em ${dateBR(m.paidAt)}` : ""} ✅`;
  if (m.status === "SEM_VALOR") return isCurrent ? "Seu mês começa a somar com o fixo, vendas e captações" : "Nada a receber neste mês";
  if (!m.dueDate) return "A receber";
  if (m.status === "ATRASADO") return `A receber · o pagamento era em ${dateBR(m.dueDate)}`;
  return `A receber em ${dateBR(m.dueDate)}${m.payRule ? ` · ${m.payRule}` : ""}`;
}

export function MyMonthView({
  months,
  current,
  awaiting,
  upcomingFees,
}: {
  months: MyMonth[];
  current: string;
  awaiting: { count: number; amount: number };
  upcomingFees: { date: string; client: string; fee: number }[];
}) {
  const [idx, setIdx] = useState(months.length - 1);
  const m = months[idx];
  const isCurrent = m.comp === current;
  const prev = months[idx - 1];
  const growth = prev && prev.total > 0 && m.total > 0 ? Math.round(((m.total - prev.total) / prev.total) * 100) : null;
  const max = Math.max(...months.map((x) => x.total), 1);
  const variable = m.commissionsTotal + m.extrasTotal;
  const onTheWay = awaiting.amount + upcomingFees.reduce((s, u) => s + u.fee, 0);
  // Total dos meses navegáveis já recebidos (um "contador" de conquista).
  const receivedYear = months.filter((x) => x.status === "PAGO").reduce((s, x) => s + x.total, 0);

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl bg-[image:var(--lh-accent-gradient)] p-6 text-accent-on">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mês anterior"
                disabled={idx === 0}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full text-accent-on/80 hover:bg-accent-on/10 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm text-accent-on/80">
                {isCurrent ? "Meu mês" : "Mês de"} · {m.label}
              </p>
              <button
                type="button"
                aria-label="Próximo mês"
                disabled={idx === months.length - 1}
                onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-accent-on/80 hover:bg-accent-on/10 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <p className="lb-figures mt-1 text-[44px] font-semibold leading-none tracking-tight">{formatCurrency(m.total)}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-accent-on/80">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  m.status === "PAGO" ? "bg-accent-on/85 text-accent" : m.status === "SEM_VALOR" ? "bg-accent-on/10" : "bg-accent-on/15",
                )}
              >
                {m.status === "PAGO" ? "Recebido" : m.status === "SEM_VALOR" ? "Sem valores" : "A receber"}
              </span>
              {statusLine(m, isCurrent)}
            </p>
          </div>
          {growth !== null && growth !== 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-on/12 px-3 py-1 text-sm font-medium">
              <ArrowUpRight size={15} className={growth < 0 ? "rotate-90" : ""} /> {growth > 0 ? "+" : ""}
              {growth}% vs {monthShort(prev!.comp)}
            </span>
          )}
        </div>

        <div className="relative grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl bg-accent-on/8 p-3">
            <p className="flex items-center gap-1 text-xs text-accent-on/70"><Wallet size={12} /> Fixo</p>
            <p className="lb-figures mt-0.5 font-semibold">{formatCurrency(m.fixed)}</p>
          </div>
          <div className="rounded-2xl bg-accent-on/8 p-3">
            <p className="flex items-center gap-1 text-xs text-accent-on/70"><HandCoins size={12} /> Comissões</p>
            <p className="lb-figures mt-0.5 font-semibold">{formatCurrency(m.commissionsTotal)}</p>
          </div>
          <div className="rounded-2xl bg-accent-on/8 p-3">
            <p className="flex items-center gap-1 text-xs text-accent-on/70"><Camera size={12} /> Extras</p>
            <p className="lb-figures mt-0.5 font-semibold">{formatCurrency(m.extrasTotal)}</p>
          </div>
        </div>

        <div className="relative flex flex-col gap-2">
          <div className="flex items-end gap-1 sm:gap-1.5" role="tablist" aria-label="Meses">
            {months.map((x, i) => {
              const active = i === idx;
              return (
                <button
                  key={x.comp}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${cap(x.label)}: ${formatCurrency(x.total)}`}
                  onClick={() => setIdx(i)}
                  className="group flex min-w-0 flex-1 flex-col items-center gap-1.5 focus-visible:outline-none"
                >
                  <div className="flex h-20 w-full items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-lg transition-colors",
                        active ? "bg-accent-on/85" : x.status === "PAGO" ? "bg-accent-on/30 group-hover:bg-accent-on/45" : "bg-accent-on/15 group-hover:bg-accent-on/30",
                        "group-focus-visible:ring-2 group-focus-visible:ring-accent-on/70",
                      )}
                      style={{ height: `${Math.max(4, Math.round((x.total / max) * 100))}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px] sm:text-[11px]", active ? "font-semibold" : "text-accent-on/60")}>{monthShort(x.comp)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-accent-on/65">Toque num mês para ver quanto entrou ou ainda vai entrar.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><Sparkles size={13} className="text-accent-light" /> Ganhos extras {isCurrent ? "no mês" : `em ${monthShort(m.comp)}`}</p>
            <p className="lb-figures text-2xl font-semibold tracking-tight text-text-primary">{formatCurrency(variable)}</p>
            <p className="text-xs text-text-tertiary">comissões + captações, além do fixo</p>
          </div>
          {isCurrent ? (
            <div className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><Clock size={13} className="text-accent-light" /> A caminho</p>
              <p className="lb-figures text-2xl font-semibold tracking-tight text-text-primary">{formatCurrency(onTheWay)}</p>
              <p className="text-xs text-text-tertiary">
                {[
                  awaiting.count ? (awaiting.count === 1 ? "1 venda aguardando o cliente pagar" : `${awaiting.count} vendas aguardando o cliente pagar`) : null,
                  upcomingFees.length ? (upcomingFees.length === 1 ? "1 captação agendada" : `${upcomingFees.length} captações agendadas`) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "venda e capte para ver isto crescer"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><Wallet size={13} className="text-accent-light" /> Recebido em 12 meses</p>
              <p className="lb-figures text-2xl font-semibold tracking-tight text-text-primary">{formatCurrency(receivedYear)}</p>
              <p className="text-xs text-text-tertiary">soma dos meses já pagos</p>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 rounded-3xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-text-primary">{isCurrent ? "O que já somou no mês" : `De onde veio · ${m.label}`}</p>
          {m.items.length === 0 && (!isCurrent || upcomingFees.length === 0) ? (
            <p className="text-sm text-text-tertiary">
              {isCurrent
                ? "Cada venda fechada e cada captação realizada aparece aqui, somando no seu mês na mesma hora."
                : m.fixed > 0
                  ? `Neste mês entrou o seu fixo de ${formatCurrency(m.fixed)}.`
                  : "Nenhum valor registrado neste mês."}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {m.items.slice(0, isCurrent ? 6 : 12).map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                    {f.kind === "c" ? <HandCoins size={14} className="shrink-0 text-success" /> : <Camera size={14} className="shrink-0 text-accent-light" />}
                    <span className="truncate">
                      {f.text}
                      {f.date ? ` · ${shortDate(f.date)}` : ""}
                    </span>
                  </span>
                  <span className="lb-figures shrink-0 font-medium text-success">+{formatCurrency(f.amount)}</span>
                </div>
              ))}
              {isCurrent &&
                upcomingFees.slice(0, 3).map((u, i) => (
                  <div key={`u${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-text-tertiary">
                      <Clock size={14} className="shrink-0" />
                      <span className="truncate">Captação {shortDate(u.date)} · {u.client}</span>
                    </span>
                    <span className="lb-figures shrink-0 text-text-tertiary">+{formatCurrency(u.fee)} previsto</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
