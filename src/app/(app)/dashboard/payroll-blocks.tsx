import Link from "next/link";
import { ArrowRight, ArrowUpRight, Camera, Clock, HandCoins, Sparkles, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { FOLHA, competenceOf, shiftCompetence } from "@/lib/payroll/folha";
import { getMonthOverview } from "@/lib/payroll/overview";

const TZ = "America/Sao_Paulo";
const dateBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: TZ });
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

// Diretoria: quanto a equipe vai receber neste mês, pessoa por pessoa.
export async function TeamPayrollSummary({ organizationId }: { organizationId: string }) {
  const o = await getMonthOverview(organizationId, competenceOf(new Date()));
  const people = o.people.filter((p) => p.total > 0);
  if (people.length === 0) return null;
  return (
    <Link href="/equipe/pagamentos" className="group flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-text-tertiary/60">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[17px] font-semibold tracking-tight text-text-primary">Equipe · {o.label}</p>
          <p className="text-sm text-text-tertiary">Fixo + comissões + cachês de cada pessoa, já na folha do mês</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-tertiary">Total da folha</p>
          <p className="lb-figures text-2xl font-semibold tracking-tight text-text-primary">{formatCurrency(o.totals.total)}</p>
          {o.nextDue && <p className="text-xs text-text-tertiary">paga a partir de {dateBR(o.nextDue)}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {people.slice(0, 6).map((p) => (
          <div key={p.memberId} className="flex items-center gap-3 rounded-2xl bg-card-elevated/60 px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[image:var(--lh-accent-gradient)] text-xs font-semibold text-accent-on">{initials(p.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{p.name}</p>
              <p className="lb-figures truncate text-[11px] text-text-tertiary">
                {[p.fixed && `fixo ${formatCurrency(p.fixed)}`, p.commissionsTotal && `comissão ${formatCurrency(p.commissionsTotal)}`, p.extrasTotal && `cachês ${formatCurrency(p.extrasTotal)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="lb-figures shrink-0 text-sm font-semibold text-text-primary">{formatCurrency(p.total)}</span>
          </div>
        ))}
      </div>
      <span className="flex items-center gap-1 text-xs text-text-secondary group-hover:text-text-primary">
        Abrir pagamentos da equipe <ArrowRight size={13} />
      </span>
    </Link>
  );
}

// Funcionário: "Meu mês" — o que já está garantido, o que está a caminho e
// o mês crescendo. Pensado para dar gás: cada venda e cada captação aparece
// somando na hora.
export async function MyMonthCard({ organizationId, userId }: { organizationId: string; userId: string }) {
  const member = await db.teamMember.findUnique({ where: { userId }, select: { id: true } });
  if (!member) return null;
  const now = new Date();
  const comp = competenceOf(now);
  const months = Array.from({ length: 6 }, (_, i) => shiftCompetence(comp, i - 5));

  const [o, history, awaiting, upcoming, settings] = await Promise.all([
    getMonthOverview(organizationId, comp, userId),
    db.accountPayable.findMany({ where: { teamMemberId: member.id, kind: FOLHA, competence: { in: months }, status: { not: "CANCELADO" } }, select: { competence: true, amount: true } }),
    db.commission.aggregate({ where: { organizationId, sellerUserId: userId, status: "AGUARDANDO_CLIENTE" }, _sum: { amount: true }, _count: true }),
    db.captureAssignment.findMany({
      where: { userId, status: { not: "RECUSADO" }, capture: { organizationId, date: { gte: now }, status: { in: ["PLANEJADA", "CONFIRMADA"] } } },
      select: { capture: { select: { date: true, client: { select: { companyName: true } }, assignments: { where: { status: { not: "RECUSADO" } }, select: { userId: true } } } } },
      orderBy: { capture: { date: "asc" } },
    }),
    db.pricingSettings.findUnique({ where: { organizationId }, select: { captureFeeSolo: true, captureFeeShared: true } }),
  ]);
  const me = o.people[0];
  if (!me) return null;

  const solo = Number(settings?.captureFeeSolo ?? 100);
  const shared = Number(settings?.captureFeeShared ?? 50);
  const upcomingFees = upcoming.map((u) => ({
    date: u.capture.date,
    client: u.capture.client.companyName,
    fee: new Set(u.capture.assignments.map((a) => a.userId)).size <= 1 ? solo : shared,
  }));
  const onTheWay = Number(awaiting._sum.amount ?? 0) + upcomingFees.reduce((s, u) => s + u.fee, 0);
  const variable = me.commissionsTotal + me.extrasTotal;

  const byComp = new Map(history.map((h) => [h.competence, Number(h.amount)]));
  byComp.set(comp, me.total);
  const series = months.map((m) => ({ m, v: byComp.get(m) ?? 0 }));
  const prev = byComp.get(shiftCompetence(comp, -1)) ?? 0;
  const growth = prev > 0 ? Math.round(((me.total - prev) / prev) * 100) : null;
  const max = Math.max(...series.map((s) => s.v), 1);

  const feed = [
    ...me.commissions.map((c) => ({ icon: "c" as const, text: c.description, amount: c.amount, date: null as string | null })),
    ...me.extras.map((e) => ({ icon: "e" as const, text: `Captação · ${e.client}`, amount: e.amount, date: e.date })),
  ].slice(0, 6);

  const monthShort = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl bg-[image:var(--lh-accent-gradient)] p-6 text-accent-on">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-accent-on/75">Meu mês · {o.label}</p>
            <p className="lb-figures mt-1 text-[44px] font-semibold leading-none tracking-tight">{formatCurrency(me.total)}</p>
            <p className="mt-2 text-sm text-accent-on/75">{me.status === "PAGO" ? "Já foi pago ✅" : `Cai em ${dateBR(me.dueDate)} · ${me.payRule}`}</p>
          </div>
          {growth !== null && growth !== 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-on/12 px-3 py-1 text-sm font-medium">
              <ArrowUpRight size={15} className={growth < 0 ? "rotate-90" : ""} /> {growth > 0 ? "+" : ""}
              {growth}% vs mês passado
            </span>
          )}
        </div>

        <div className="relative grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl bg-accent-on/8 p-3">
            <p className="flex items-center gap-1 text-xs text-accent-on/70"><Wallet size={12} /> Fixo</p>
            <p className="lb-figures mt-0.5 font-semibold">{formatCurrency(me.fixed)}</p>
          </div>
          <div className="rounded-2xl bg-accent-on/8 p-3">
            <p className="flex items-center gap-1 text-xs text-accent-on/70"><HandCoins size={12} /> Comissões</p>
            <p className="lb-figures mt-0.5 font-semibold">{formatCurrency(me.commissionsTotal)}</p>
          </div>
          <div className="rounded-2xl bg-accent-on/8 p-3">
            <p className="flex items-center gap-1 text-xs text-accent-on/70"><Camera size={12} /> Extras</p>
            <p className="lb-figures mt-0.5 font-semibold">{formatCurrency(me.extrasTotal)}</p>
          </div>
        </div>

        <div className="relative flex items-end gap-2">
          {series.map((s) => (
            <div key={s.m} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-20 w-full items-end">
                <div
                  className={`w-full rounded-t-lg ${s.m === comp ? "bg-accent-on/80" : "bg-accent-on/20"}`}
                  style={{ height: `${Math.max(4, Math.round((s.v / max) * 100))}%` }}
                  title={formatCurrency(s.v)}
                />
              </div>
              <span className={`text-[11px] ${s.m === comp ? "font-semibold" : "text-accent-on/60"}`}>{monthShort(s.m)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><Sparkles size={13} className="text-accent-light" /> Ganhos extras no mês</p>
            <p className="lb-figures text-2xl font-semibold tracking-tight text-text-primary">{formatCurrency(variable)}</p>
            <p className="text-xs text-text-tertiary">comissões + captações, além do fixo</p>
          </div>
          <div className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary"><Clock size={13} className="text-accent-light" /> A caminho</p>
            <p className="lb-figures text-2xl font-semibold tracking-tight text-text-primary">{formatCurrency(onTheWay)}</p>
            <p className="text-xs text-text-tertiary">
              {[awaiting._count ? (awaiting._count === 1 ? "1 venda aguardando o cliente pagar" : `${awaiting._count} vendas aguardando o cliente pagar`) : null, upcomingFees.length ? (upcomingFees.length === 1 ? "1 captação agendada" : `${upcomingFees.length} captações agendadas`) : null].filter(Boolean).join(" · ") || "venda e capte para ver isto crescer"}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 rounded-3xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-text-primary">O que já somou no mês</p>
          {feed.length === 0 && upcomingFees.length === 0 ? (
            <p className="text-sm text-text-tertiary">Cada venda fechada e cada captação realizada aparece aqui, somando no seu mês na mesma hora.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {feed.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                    {f.icon === "c" ? <HandCoins size={14} className="shrink-0 text-success" /> : <Camera size={14} className="shrink-0 text-accent-light" />}
                    <span className="truncate">{f.text}</span>
                  </span>
                  <span className="lb-figures shrink-0 font-medium text-success">+{formatCurrency(f.amount)}</span>
                </div>
              ))}
              {upcomingFees.slice(0, 3).map((u, i) => (
                <div key={`u${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-text-tertiary">
                    <Clock size={14} className="shrink-0" />
                    <span className="truncate">Captação {u.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ })} · {u.client}</span>
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
