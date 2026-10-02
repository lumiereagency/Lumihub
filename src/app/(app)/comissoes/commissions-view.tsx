"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CircleDollarSign, Clock, HandCoins, Undo2, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { cancelCommissionAction, payAllForSellerAction, payCommissionAction, releaseCommissionAction, undoCommissionAction } from "@/lib/actions/commission-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";

type Status = "AGUARDANDO_CLIENTE" | "A_PAGAR" | "PAGA" | "CANCELADA";

interface Row {
  id: string;
  proposalId: string;
  proposalTitle: string;
  clientName: string;
  sellerId: string | null;
  sellerName: string;
  stage: string;
  description: string;
  amount: number;
  status: Status;
  createdAt: string;
  releasedAt: string | null;
  paidAt: string | null;
  cancelReason: string | null;
  lines: { name: string; rule: string; amount: number }[];
}

const STATUS_META: Record<Status, { label: string; tone: "warning" | "accent" | "success" | "neutral" }> = {
  AGUARDANDO_CLIENTE: { label: "Aguardando o cliente pagar", tone: "warning" },
  A_PAGAR: { label: "A pagar", tone: "accent" },
  PAGA: { label: "Paga", tone: "success" },
  CANCELADA: { label: "Estornada", tone: "neutral" },
};

const FILTERS: { key: Status | "TODAS"; label: string }[] = [
  { key: "A_PAGAR", label: "A pagar" },
  { key: "AGUARDANDO_CLIENTE", label: "Aguardando cliente" },
  { key: "PAGA", label: "Pagas" },
  { key: "CANCELADA", label: "Estornadas" },
  { key: "TODAS", label: "Todas" },
];

const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const sum = (rows: Row[]) => rows.reduce((s, r) => s + r.amount, 0);

export function CommissionsView({ director, currentUserId, monthStart, commissions }: { director: boolean; currentUserId: string; monthStart: string; commissions: Row[] }) {
  const [filter, setFilter] = useState<Status | "TODAS">(() => (commissions.some((c) => c.status === "A_PAGAR") ? "A_PAGAR" : "TODAS"));
  const [seller, setSeller] = useState<string>("TODOS");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const month = new Date(monthStart).getTime();

  const stats = useMemo(() => {
    const active = commissions.filter((c) => c.status !== "CANCELADA");
    return {
      toPay: sum(commissions.filter((c) => c.status === "A_PAGAR")),
      waiting: sum(commissions.filter((c) => c.status === "AGUARDANDO_CLIENTE")),
      paidMonth: sum(commissions.filter((c) => c.status === "PAGA" && c.paidAt && new Date(c.paidAt).getTime() >= month)),
      soldMonth: sum(active.filter((c) => new Date(c.createdAt).getTime() >= month)),
      paidAll: sum(commissions.filter((c) => c.status === "PAGA")),
    };
  }, [commissions, month]);

  const bySeller = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; toPay: number; waiting: number; paidMonth: number }>();
    for (const c of commissions) {
      const key = c.sellerId ?? "none";
      const cur = map.get(key) ?? { id: c.sellerId, name: c.sellerName, toPay: 0, waiting: 0, paidMonth: 0 };
      if (c.status === "A_PAGAR") cur.toPay += c.amount;
      if (c.status === "AGUARDANDO_CLIENTE") cur.waiting += c.amount;
      if (c.status === "PAGA" && c.paidAt && new Date(c.paidAt).getTime() >= month) cur.paidMonth += c.amount;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.toPay - a.toPay || b.waiting - a.waiting);
  }, [commissions, month]);

  const visible = commissions.filter((c) => (filter === "TODAS" || c.status === filter) && (seller === "TODOS" || (c.sellerId ?? "none") === seller));

  function run(fn: () => Promise<{ ok: true; count?: number } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const r = await fn();
      setNotice(r.ok ? { ok: true, text: success } : { ok: false, text: r.error });
    });
  }

  if (commissions.length === 0) {
    return (
      <EmptyState
        icon={<HandCoins size={26} />}
        title="Nenhuma comissão ainda"
        description={
          director
            ? "Quando um cliente aceitar um orçamento pelo link, a comissão de quem vendeu aparece aqui, já calculada pela tabela."
            : "Quando um cliente aceitar um orçamento seu pelo link, a comissão aparece aqui, já calculada pela tabela."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label={director ? "A pagar agora" : "Liberado para receber"} value={formatCurrency(stats.toPay)} tone="accent" icon={<Wallet size={16} />} caption="cliente já pagou" />
        <MetricCard label="Aguardando o cliente" value={formatCurrency(stats.waiting)} icon={<Clock size={16} />} caption="venda fechada, pagamento pendente" />
        <MetricCard label={director ? "Pago no mês" : "Recebido no mês"} value={formatCurrency(stats.paidMonth)} icon={<CircleDollarSign size={16} />} />
        <MetricCard label="Vendido no mês" value={formatCurrency(stats.soldMonth)} caption={`total pago até hoje: ${formatCurrency(stats.paidAll)}`} />
      </div>

      {notice && (
        <p role="status" className={cn("rounded-2xl px-4 py-3 text-sm", notice.ok ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
          {notice.text}
        </p>
      )}

      {director && bySeller.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-[17px] font-semibold tracking-tight text-text-primary">Por vendedor</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {bySeller.map((s) => (
              <article key={s.id ?? "none"} className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => setSeller(s.id ?? "none")} className="text-left font-semibold text-text-primary hover:text-accent-light">
                    {s.name}
                  </button>
                  <span className="text-xs text-text-tertiary">pago no mês {formatCurrency(s.paidMonth)}</span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-text-tertiary">A pagar</p>
                    <p className="lb-figures text-2xl font-semibold tracking-tight text-text-primary">{formatCurrency(s.toPay)}</p>
                    {s.waiting > 0 && <p className="lb-figures text-xs text-text-tertiary">+ {formatCurrency(s.waiting)} aguardando cliente</p>}
                  </div>
                  {s.id && s.toPay > 0 && (
                    <Button
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Marcar ${formatCurrency(s.toPay)} como pago para ${s.name}?`)) return;
                        run(() => payAllForSellerAction(s.id!), `Pagamento de ${s.name} registrado.`);
                      }}
                    >
                      Paguei tudo
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
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
        {director && bySeller.length > 1 && (
          <select
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            aria-label="Filtrar por vendedor"
            className="ml-auto h-9 rounded-full border border-border bg-card px-3 text-sm text-text-primary focus:outline-none"
          >
            <option value="TODOS">Todos os vendedores</option>
            {bySeller.map((s) => (
              <option key={s.id ?? "none"} value={s.id ?? "none"}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card px-4 py-10 text-center text-sm text-text-tertiary">Nada por aqui com esse filtro.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((c) => {
            const meta = STATUS_META[c.status];
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/propostas/${c.proposalId}`} className="truncate font-medium text-text-primary hover:text-accent-light">
                      {c.clientName} · {c.proposalTitle}
                    </Link>
                    <Badge tone={meta.tone} dot>
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    {director && c.sellerId !== currentUserId ? `${c.sellerName} · ` : ""}
                    {c.description} · fechada em {day(c.createdAt)}
                    {c.paidAt ? ` · paga em ${day(c.paidAt)}` : c.releasedAt ? ` · liberada em ${day(c.releasedAt)}` : ""}
                    {c.cancelReason ? ` · ${c.cancelReason}` : ""}
                  </p>
                  {c.lines.length > 0 && (
                    <p className="mt-1 text-xs text-text-tertiary">
                      {c.lines.map((l) => `${l.name} (${l.rule})`).join(" · ")}
                      {c.stage !== "INTEGRAL" ? " — metade nesta etapa" : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <p className={cn("lb-figures text-lg font-semibold tracking-tight", c.status === "CANCELADA" ? "text-text-tertiary line-through" : "text-text-primary")}>
                    {formatCurrency(c.amount)}
                  </p>
                  {director && (
                    <div className="flex items-center gap-1.5">
                      {c.status === "AGUARDANDO_CLIENTE" && (
                        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => releaseCommissionAction(c.id), "Comissão liberada para pagamento.")}>
                          {c.stage === "SINAL" ? "Sinal recebido" : c.stage === "QUITACAO" ? "Quitação recebida" : "Cliente pagou"}
                        </Button>
                      )}
                      {c.status === "A_PAGAR" && (
                        <Button size="sm" disabled={pending} onClick={() => run(() => payCommissionAction(c.id), "Comissão marcada como paga.")}>
                          Marcar paga
                        </Button>
                      )}
                      {c.status !== "CANCELADA" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            const reason = prompt("Motivo do estorno (ex: cliente cancelou antes da 2ª mensalidade):");
                            if (reason === null) return;
                            run(() => cancelCommissionAction(c.id, reason), "Comissão estornada.");
                          }}
                          className="h-8 rounded-full px-2.5 text-xs text-text-tertiary hover:bg-error/10 hover:text-error"
                        >
                          Estornar
                        </button>
                      )}
                      {c.status !== "AGUARDANDO_CLIENTE" && (
                        <button
                          type="button"
                          aria-label="Desfazer último passo"
                          title="Desfazer último passo"
                          disabled={pending}
                          onClick={() => run(() => undoCommissionAction(c.id), "Passo desfeito.")}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
