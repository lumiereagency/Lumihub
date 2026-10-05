import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { competenceOf, shiftCompetence } from "@/lib/payroll/folha";
import { getMonthOverview } from "@/lib/payroll/overview";
import { MyMonthView, type MyMonth } from "./my-month-view";
import { extraKindLabel } from "@/lib/payroll/extra-kinds";

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
          <p className="text-sm text-text-tertiary">Fixo + comissões + extras de cada pessoa, já na folha do mês</p>
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
                {[p.fixed && `fixo ${formatCurrency(p.fixed)}`, p.commissionsTotal && `comissão ${formatCurrency(p.commissionsTotal)}`, p.extrasTotal && `extras ${formatCurrency(p.extrasTotal)}`].filter(Boolean).join(" · ")}
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
// somando na hora. Os últimos 12 meses ficam navegáveis (clique na barra).
export async function MyMonthCard({ organizationId, userId }: { organizationId: string; userId: string }) {
  const member = await db.teamMember.findUnique({ where: { userId }, select: { id: true } });
  if (!member) return null;
  const now = new Date();
  const comp = competenceOf(now);
  const comps = Array.from({ length: 12 }, (_, i) => shiftCompetence(comp, i - 11));
  // Folha do mês que vem já aberta (ex.: extra lançado depois de a folha deste mês ser paga).
  const next = shiftCompetence(comp, 1);
  if (await db.accountPayable.count({ where: { teamMemberId: member.id, kind: "FOLHA", competence: next, status: { not: "CANCELADO" } } })) comps.push(next);

  const [overviews, awaiting, upcoming, settings] = await Promise.all([
    Promise.all(comps.map((c) => getMonthOverview(organizationId, c, userId))),
    db.commission.aggregate({ where: { organizationId, sellerUserId: userId, status: "AGUARDANDO_CLIENTE" }, _sum: { amount: true }, _count: true }),
    db.captureAssignment.findMany({
      where: { userId, status: { not: "RECUSADO" }, capture: { organizationId, date: { gte: now }, status: { in: ["PLANEJADA", "CONFIRMADA"] } } },
      select: { capture: { select: { date: true, client: { select: { companyName: true } }, assignments: { where: { status: { not: "RECUSADO" } }, select: { userId: true } } } } },
      orderBy: { capture: { date: "asc" } },
    }),
    db.pricingSettings.findUnique({ where: { organizationId }, select: { captureFeeSolo: true, captureFeeShared: true } }),
  ]);
  if (!overviews.find((o) => o.competence === comp)?.people[0]) return null;

  const months: MyMonth[] = overviews.map((o) => {
    const me = o.people[0];
    return {
      comp: o.competence,
      label: o.label,
      total: me?.total ?? 0,
      fixed: me?.fixed ?? 0,
      commissionsTotal: me?.commissionsTotal ?? 0,
      extrasTotal: me?.extrasTotal ?? 0,
      status: me?.status ?? "SEM_VALOR",
      dueDate: me?.dueDate ?? null,
      paidAt: me?.paidAt ?? null,
      payRule: me?.payRule ?? "",
      items: [
        ...(me?.commissions ?? []).map((c) => ({ kind: "c" as const, text: c.description, amount: c.amount, date: null })),
        ...(me?.extras ?? []).map((e) => ({ kind: "e" as const, text: `Captação · ${e.client}`, amount: e.amount, date: e.date })),
        ...(me?.bonuses ?? []).map((b) => ({ kind: "e" as const, text: `${extraKindLabel(b.kind)} · ${b.description}${b.recurring ? " (todo mês)" : ""}`, amount: b.amount, date: null })),
      ],
    };
  });

  const solo = Number(settings?.captureFeeSolo ?? 100);
  const shared = Number(settings?.captureFeeShared ?? 50);
  const upcomingFees = upcoming.map((u) => ({
    date: u.capture.date.toISOString(),
    client: u.capture.client.companyName,
    fee: new Set(u.capture.assignments.map((a) => a.userId)).size <= 1 ? solo : shared,
  }));

  return (
    <MyMonthView
      months={months}
      current={comp}
      awaiting={{ count: awaiting._count, amount: Number(awaiting._sum.amount ?? 0) }}
      upcomingFees={upcomingFees}
    />
  );
}
