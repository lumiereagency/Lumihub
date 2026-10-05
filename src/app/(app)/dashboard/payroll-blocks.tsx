import Link from "next/link";
import { ArrowRight, Camera, HandCoins, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { competenceOf } from "@/lib/payroll/folha";
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

// Funcionário: o que vai receber, de onde vem e quando cai.
export async function MyMonthCard({ organizationId, userId }: { organizationId: string; userId: string }) {
  const member = await db.teamMember.findUnique({ where: { userId }, select: { id: true } });
  if (!member) return null;
  const o = await getMonthOverview(organizationId, competenceOf(new Date()), userId);
  const me = o.people[0];
  if (!me) return null;
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col justify-between gap-5 rounded-3xl bg-[image:var(--lh-accent-gradient)] p-6 text-accent-on">
        <div>
          <p className="text-sm text-accent-on/75">Meu mês · {o.label}</p>
          <p className="lb-figures mt-1 text-[38px] font-semibold leading-tight tracking-tight">{formatCurrency(me.total)}</p>
          <p className="text-sm text-accent-on/75">
            {me.status === "PAGO" ? "Já foi pago ✅" : `Previsto para ${dateBR(me.dueDate)} (${me.payRule})`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="flex items-center gap-1 text-xs text-accent-on/70"><Wallet size={12} /> Fixo</p>
            <p className="lb-figures font-semibold">{formatCurrency(me.fixed)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-accent-on/70"><HandCoins size={12} /> Comissões</p>
            <p className="lb-figures font-semibold">{formatCurrency(me.commissionsTotal)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-accent-on/70"><Camera size={12} /> Extras</p>
            <p className="lb-figures font-semibold">{formatCurrency(me.extrasTotal)}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-text-primary">De onde vem</p>
        {me.commissions.length === 0 && me.extras.length === 0 ? (
          <p className="text-sm text-text-tertiary">Comissões de vendas fechadas e cachês de captações realizadas aparecem aqui assim que entram.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {me.commissions.map((c, i) => (
              <div key={`c${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                  <HandCoins size={14} className="shrink-0 text-success" /> <span className="truncate">{c.description}</span>
                </span>
                <span className="lb-figures shrink-0 text-text-primary">{formatCurrency(c.amount)}</span>
              </div>
            ))}
            {me.extras.map((e, i) => (
              <div key={`e${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-text-secondary">
                  <Camera size={14} className="shrink-0 text-accent-light" />
                  <span className="truncate">Captação · {e.client} · {new Date(e.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ })}</span>
                </span>
                <span className="lb-figures shrink-0 text-text-primary">{formatCurrency(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
