import { notFound, redirect } from "next/navigation";
import { requireUser, isDirector, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { EXTRAS_TABS, filterTabsForUser } from "@/lib/nav";
import { competenceLabel, competenceOf, syncPayroll } from "@/lib/payroll/folha";
import type { ExtraKind } from "@/lib/payroll/extra-kinds";
import { ExtrasBoard, type ExtraRow } from "./extras-board";

const TIPOS: Record<string, { kind: ExtraKind; title: string; hint: string }> = {
  "edicao-de-video": { kind: "EDICAO_VIDEO", title: "Edição de vídeo", hint: "Ex.: edição de Reels, vídeo institucional, corte para stories" },
  "servicos-graficos": { kind: "GRAFICO", title: "Serviços gráficos", hint: "Ex.: identidade visual, artes para feed, cardápio, banner" },
};

export default async function ExtrasKindPage({ params }: PageProps<"/extras/[tipo]">) {
  const { tipo } = await params;
  const cfg = TIPOS[tipo];
  if (!cfg) notFound();

  const user = await requireUser();
  const director = isDirector(user);
  const seeAll = director || hasPermission(user, permKey("PAYABLES", "VIEW"));
  const canManage = director || hasPermission(user, permKey("PAYABLES", "EDIT"));
  const me = await db.teamMember.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!seeAll && !me && !hasPermission(user, permKey("CAPTURES", "VIEW"))) redirect("/acesso-negado");

  await syncPayroll(user.organizationId);
  const current = competenceOf(new Date());

  // Quem não cuida da folha vê só os próprios extras.
  const memberFilter = seeAll ? {} : { teamMemberId: me?.id ?? "__nenhum__" };
  const [bonuses, members] = await Promise.all([
    db.extraBonus.findMany({
      where: { organizationId: user.organizationId, kind: cfg.kind, ...memberFilter },
      include: { teamMember: { select: { name: true } }, entries: { select: { competence: true, amount: true, payableId: true } } },
      orderBy: { date: "desc" },
      take: 300,
    }),
    canManage
      ? db.teamMember.findMany({ where: { organizationId: user.organizationId, active: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const payableIds = [...new Set(bonuses.flatMap((b) => b.entries.map((e) => e.payableId)).filter((x): x is string => !!x))];
  const payables = payableIds.length
    ? await db.accountPayable.findMany({ where: { id: { in: payableIds } }, select: { id: true, status: true, dueDate: true, paidAt: true, competence: true } })
    : [];
  const payableById = new Map(payables.map((p) => [p.id, p]));

  const rows: ExtraRow[] = bonuses.map((b) => {
    const entries = b.entries
      .map((e) => {
        const p = e.payableId ? payableById.get(e.payableId) : undefined;
        return {
          competence: e.competence,
          label: competenceLabel(p?.competence ?? e.competence),
          amount: Number(e.amount),
          paid: p?.status === "PAGO",
          dueDate: p?.dueDate.toISOString() ?? null,
          paidAt: p?.paidAt?.toISOString() ?? null,
        };
      })
      .sort((a, z) => z.competence.localeCompare(a.competence));
    const start = competenceOf(b.date);
    return {
      id: b.id,
      person: b.teamMember.name,
      description: b.description,
      clientName: b.clientName,
      amount: Number(b.amount),
      recurring: b.recurring,
      date: b.date.toISOString(),
      startMonth: start,
      startLabel: competenceLabel(start),
      endMonth: b.endCompetence,
      endLabel: b.endCompetence ? competenceLabel(b.endCompetence) : null,
      active: !b.recurring || !b.endCompetence || b.endCompetence >= current,
      entries,
      paidTotal: entries.filter((e) => e.paid).reduce((s, e) => s + e.amount, 0),
    };
  });

  const thisMonth = bonuses.flatMap((b) => b.entries.filter((e) => e.competence === current).map((e) => ({ amount: Number(e.amount), member: b.teamMemberId })));

  return (
    <div>
      <PageHeader title="Extras" description="Captações, edição de vídeo e serviços gráficos: o que cada pessoa faz além do fixo entra nos ganhos do mês." />
      <SectionTabs tabs={filterTabsForUser(EXTRAS_TABS, user.permissions)} />
      <ExtrasBoard
        kind={cfg.kind}
        title={cfg.title}
        hint={cfg.hint}
        rows={rows}
        members={members}
        canManage={canManage}
        own={!seeAll}
        summary={{
          monthLabel: competenceLabel(current),
          monthTotal: thisMonth.reduce((s, x) => s + x.amount, 0),
          people: new Set(thisMonth.map((x) => x.member)).size,
          recurringActive: rows.filter((r) => r.recurring && r.active).length,
          recurringMonthly: rows.filter((r) => r.recurring && r.active).reduce((s, r) => s + r.amount, 0),
        }}
        currentMonth={current}
      />
    </div>
  );
}
