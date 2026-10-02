"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Eye, EyeOff, FileText, MessageSquareText, PenLine, Plus } from "lucide-react";
import { PROPOSAL_STATUS_LABELS } from "@/lib/validation/proposals";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";

export interface ProposalRow {
  id: string;
  title: string;
  partyName: string | null;
  recipientName: string | null;
  createdBy: string | null;
  value: number;
  monthlyTotal: number | null;
  oneTimeTotal: number | null;
  currency: string;
  status: string;
  validUntil: string | null;
  sentAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  response: string | null;
  contractStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";
const STATUS_TONE: Record<string, Tone> = { RASCUNHO: "neutral", ENVIADA: "info", EM_NEGOCIACAO: "warning", ACEITA: "success", RECUSADA: "error", EXPIRADA: "neutral" };

const FILTERS = [
  { key: "ABERTOS", label: "Em aberto" },
  { key: "RASCUNHO", label: "Rascunhos" },
  { key: "ACEITA", label: "Aceitos" },
  { key: "PERDIDOS", label: "Recusados e expirados" },
  { key: "TODOS", label: "Todos" },
] as const;

function effectiveStatus(p: ProposalRow, now: number): string {
  if ((p.status === "ENVIADA" || p.status === "EM_NEGOCIACAO") && p.validUntil && new Date(p.validUntil).getTime() < now) return "EXPIRADA";
  return p.status;
}

function priceLabel(p: ProposalRow): string {
  const money = (v: number) => formatCurrency(v, p.currency);
  if (p.monthlyTotal && p.oneTimeTotal) return `${money(p.monthlyTotal)}/mês + ${money(p.oneTimeTotal)}`;
  if (p.monthlyTotal) return `${money(p.monthlyTotal)}/mês`;
  return money(p.oneTimeTotal ?? p.value);
}

export function ProposalBoard({ proposals, currency, canCreate, now }: { proposals: ProposalRow[]; currency: string; canCreate: boolean; now: number }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ABERTOS");

  const rows = useMemo(() => proposals.map((p) => ({ ...p, effective: effectiveStatus(p, now) })), [proposals, now]);

  const stats = useMemo(() => {
    const open = rows.filter((p) => p.effective === "ENVIADA" || p.effective === "EM_NEGOCIACAO");
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const accepted = rows.filter((p) => p.status === "ACEITA").length;
    const lost = rows.filter((p) => p.status === "RECUSADA").length;
    return {
      pipeline: open.reduce((s, p) => s + p.value, 0),
      sentThisMonth: rows.filter((p) => p.sentAt && new Date(p.sentAt) >= monthStart).length,
      winRate: accepted + lost ? Math.round((accepted / (accepted + lost)) * 100) : 0,
      unseen: open.filter((p) => p.viewCount === 0).length,
    };
  }, [rows, now]);

  const visible = rows.filter((p) => {
    if (filter === "TODOS") return true;
    if (filter === "ABERTOS") return p.effective === "ENVIADA" || p.effective === "EM_NEGOCIACAO";
    if (filter === "PERDIDOS") return p.effective === "RECUSADA" || p.effective === "EXPIRADA";
    return p.effective === filter;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Em negociação" value={formatCurrency(stats.pipeline, currency)} tone="accent" caption="valor dos orçamentos em aberto" />
        <MetricCard label="Enviados no mês" value={String(stats.sentThisMonth)} />
        <MetricCard label="Taxa de aceite" value={`${stats.winRate}%`} />
        <MetricCard label="Enviados e não vistos" value={String(stats.unseen)} icon={stats.unseen ? <AlertCircle size={16} /> : undefined} caption="vale um toque no WhatsApp" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                filter === f.key ? "border-transparent bg-ink text-ink-on" : "border-border bg-card text-text-secondary hover:text-text-primary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <Link href="/propostas/nova" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-ink-on hover:opacity-90">
            <Plus size={16} /> Novo orçamento
          </Link>
        )}
      </div>

      {proposals.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title="Nenhum orçamento ainda"
          description="Monte um orçamento com os serviços da tabela, envie o link personalizado pelo WhatsApp e acompanhe quando o cliente abre e responde."
          action={
            canCreate && (
              <Link href="/propostas/nova" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-ink-on">
                <Plus size={16} /> Criar primeiro orçamento
              </Link>
            )
          }
        />
      ) : visible.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card px-4 py-10 text-center text-sm text-text-tertiary">Nada por aqui com esse filtro.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((p) => (
            <Link key={p.id} href={`/propostas/${p.id}`} className="group flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-text-tertiary/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text-primary">{p.title}</p>
                  <p className="truncate text-sm text-text-tertiary">{[p.partyName, p.recipientName].filter(Boolean).join(" · ") || "Sem cliente"}</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-text-tertiary group-hover:bg-ink group-hover:text-ink-on">
                  <ArrowUpRight size={16} />
                </span>
              </div>
              <p className="lb-figures text-lg font-semibold tracking-tight text-text-primary">{priceLabel(p)}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={STATUS_TONE[p.effective] ?? "neutral"} dot>
                  {PROPOSAL_STATUS_LABELS[p.effective as keyof typeof PROPOSAL_STATUS_LABELS] ?? p.effective}
                </Badge>
                {p.sentAt && p.status !== "ACEITA" && (
                  <Badge tone={p.viewCount ? "accent" : "neutral"}>
                    {p.viewCount ? <Eye size={12} /> : <EyeOff size={12} />} {p.viewCount ? `Visto ${p.viewCount}x` : "Não visto"}
                  </Badge>
                )}
                {p.response === "AJUSTE" && p.status !== "ACEITA" && (
                  <Badge tone="warning">
                    <MessageSquareText size={12} /> Pediu ajuste
                  </Badge>
                )}
                {p.status === "ACEITA" && (
                  <Badge tone={p.contractStatus === "SIGNED" ? "success" : "neutral"}>
                    <PenLine size={12} /> {p.contractStatus === "SIGNED" ? "Contrato assinado" : p.contractStatus && p.contractStatus !== "DRAFT" ? "Aguardando assinatura" : "Enviar contrato"}
                  </Badge>
                )}
              </div>
              <p className="mt-auto text-xs text-text-tertiary" suppressHydrationWarning>
                {p.createdBy ? `${p.createdBy.split(" ")[0]} · ` : ""}
                atualizado {new Date(p.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
