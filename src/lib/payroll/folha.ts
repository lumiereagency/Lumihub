import "server-only";
import { db } from "@/lib/db";
import { brasiliaDay, noonOf } from "@/lib/billing/dates";
import { parsePayDayMode, payDayOf } from "@/lib/payroll/business-days";
import type { Prisma } from "@/generated/prisma/client";

// FOLHA DO MÊS — uma conta a pagar por pessoa por mês de competência:
//   fixo (salário) + comissões liberadas + cachês de captação.
// O que é ganho no mês M é pago no dia de pagamento da pessoa no mês M+1
// (ex: 5º dia útil). Enquanto a folha não é paga, o valor se recalcula
// sozinho; o que entra depois que a folha do mês já foi paga vai para a
// próxima. Quando a folha é paga, as comissões dela viram "Paga".

export const FOLHA = "FOLHA";
const PAYROLL_CATEGORY_NAME = "Folha de Pagamento";
const DONE_CAPTURE = ["REALIZADA", "EM_EDICAO", "ENTREGUE"] as const;

type Tx = Prisma.TransactionClient;
type Db = typeof db | Tx;

export function competenceOf(date: Date): string {
  return brasiliaDay(date).slice(0, 7);
}

export function shiftCompetence(comp: string, months: number): string {
  const [y, m] = comp.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 7);
}

export function competenceLabel(comp: string): string {
  const [y, m] = comp.split("-").map(Number);
  const name = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  return `${name} de ${y}`;
}

interface MemberRule {
  paymentDay: number | null;
  paymentDayMode: string;
}

// Data de pagamento da folha de uma competência: regra da pessoa no mês seguinte
// (sem regra definida: 5º dia útil).
export function folhaDueDate(member: MemberRule, comp: string): Date {
  const [y, m] = shiftCompetence(comp, 1).split("-").map(Number);
  const mode = parsePayDayMode(member.paymentDayMode);
  const hasRule = mode !== "FIXED" || !!member.paymentDay;
  return noonOf(hasRule ? payDayOf(y, m, mode, member.paymentDay) : payDayOf(y, m, "BUSINESS_DAY", 5));
}

async function payrollCategory(tx: Db, organizationId: string): Promise<string> {
  const existing = await tx.financialCategory.findFirst({ where: { organizationId, name: PAYROLL_CATEGORY_NAME, type: "DESPESA" } });
  if (existing) return existing.id;
  return (await tx.financialCategory.create({ data: { organizationId, name: PAYROLL_CATEGORY_NAME, type: "DESPESA" } })).id;
}

// Quem ganha comissão ou cachê precisa estar na equipe para entrar na folha.
// O dono da conta não paga a si mesmo.
export async function ensureMemberForUser(tx: Db, organizationId: string, userId: string) {
  const existing = await tx.teamMember.findUnique({ where: { userId } });
  if (existing) return existing;
  const user = await tx.user.findFirst({ where: { id: userId, organizationId }, select: { name: true, isOwner: true, role: { select: { name: true } } } });
  if (!user || user.isOwner) return null;
  return tx.teamMember.create({
    data: { organizationId, userId, name: user.name, role: user.role.name, type: "FUNCIONARIO", paymentDayMode: "BUSINESS_DAY", paymentDay: 5 },
  });
}

// Folha em aberto da pessoa para a competência (ou a próxima em aberto, se aquela já foi paga).
async function openFolha(tx: Db, member: { id: string; organizationId: string; name: string; role: string; paymentDay: number | null; paymentDayMode: string }, comp: string) {
  for (let i = 0, c = comp; i < 24; i++, c = shiftCompetence(c, 1)) {
    const found = await tx.accountPayable.findFirst({ where: { teamMemberId: member.id, kind: FOLHA, competence: c, status: { not: "CANCELADO" } } });
    if (found?.status === "PENDENTE" || found?.status === "ATRASADO") return found;
    if (found) continue; // já paga: vai para o próximo mês
    const dueDate = folhaDueDate(member, c);
    const categoryId = await payrollCategory(tx, member.organizationId);
    const movement = await tx.financialMovement.create({
      data: { organizationId: member.organizationId, type: "DESPESA", amount: 0, competenceDate: noonOf(`${c}-15`), dueDate, categoryId, status: "PENDENTE", notes: "Folha do mês (fixo + comissões + cachês)." },
    });
    return tx.accountPayable.create({
      data: {
        organizationId: member.organizationId,
        teamMemberId: member.id,
        movementId: movement.id,
        kind: FOLHA,
        competence: c,
        description: `Folha ${competenceLabel(c)} — ${member.name}`,
        supplier: member.name,
        categoryId,
        amount: 0,
        dueDate,
        status: "PENDENTE",
      },
    });
  }
  throw new Error("Não foi possível encontrar uma folha em aberto.");
}

export interface FolhaBreakdown {
  fixed: number;
  commissions: { id: string; description: string; amount: number }[];
  extras: { id: string; captureId: string; date: string; client: string; role: string; amount: number }[];
}

// Recalcula valor, vencimento e composição de uma folha em aberto.
async function recalcFolha(tx: Db, payableId: string) {
  const p = await tx.accountPayable.findUniqueOrThrow({ where: { id: payableId }, include: { teamMember: true } });
  if (p.status === "PAGO" || p.status === "CANCELADO" || !p.teamMember || !p.competence) return;
  const member = p.teamMember;
  const [commissions, extras] = await Promise.all([
    tx.commission.findMany({ where: { payableId, status: "A_PAGAR" }, select: { id: true, description: true, amount: true } }),
    tx.captureAssignment.findMany({
      where: { payableId, fee: { not: null } },
      select: { id: true, role: true, fee: true, capture: { select: { id: true, date: true, client: { select: { companyName: true } } } } },
    }),
  ]);
  const fixed = member.active && member.paymentValue ? Number(member.paymentValue) : 0;
  const breakdown: FolhaBreakdown = {
    fixed,
    commissions: commissions.map((c) => ({ id: c.id, description: c.description, amount: Number(c.amount) })),
    extras: extras.map((e) => ({ id: e.id, captureId: e.capture.id, date: e.capture.date.toISOString(), client: e.capture.client.companyName, role: e.role, amount: Number(e.fee) })),
  };
  const amount = Math.round((fixed + breakdown.commissions.reduce((s, c) => s + c.amount, 0) + breakdown.extras.reduce((s, e) => s + e.amount, 0)) * 100) / 100;

  if (amount === 0) {
    // Nada a pagar neste mês: some das contas a pagar.
    await tx.accountPayable.delete({ where: { id: p.id } });
    if (p.movementId) await tx.financialMovement.delete({ where: { id: p.movementId } }).catch(() => {});
    return;
  }
  const dueDate = folhaDueDate(member, p.competence);
  await tx.accountPayable.update({
    where: { id: p.id },
    data: { amount, dueDate, breakdown: breakdown as object, description: `Folha ${competenceLabel(p.competence)} — ${member.name}`, supplier: member.name },
  });
  if (p.movementId) await tx.financialMovement.update({ where: { id: p.movementId }, data: { amount, dueDate } }).catch(() => {});
}

// Cachês de uma captação realizada: sozinho = valor cheio; em dupla (ou mais) = valor por pessoa.
export async function applyCaptureFees(tx: Db, captureId: string) {
  const capture = await tx.capture.findUniqueOrThrow({ where: { id: captureId }, include: { assignments: true } });
  const done = (DONE_CAPTURE as readonly string[]).includes(capture.status);
  const crew = capture.assignments.filter((a) => a.status !== "RECUSADO");
  if (!done) {
    // Voltou para planejada/confirmada: tira os cachês que ainda não foram pagos.
    for (const a of capture.assignments.filter((x) => x.fee !== null)) {
      const paid = a.payableId ? await tx.accountPayable.findFirst({ where: { id: a.payableId, status: "PAGO" } }) : null;
      if (!paid) await tx.captureAssignment.update({ where: { id: a.id }, data: { fee: null, payableId: null, feeManual: false } });
    }
    return;
  }
  const settings = await tx.pricingSettings.findUnique({ where: { organizationId: capture.organizationId }, select: { captureFeeSolo: true, captureFeeShared: true } });
  const solo = Number(settings?.captureFeeSolo ?? 100);
  const shared = Number(settings?.captureFeeShared ?? 50);
  const people = new Set(crew.map((a) => a.userId)).size;
  const auto = people <= 1 ? solo : shared;
  for (const a of crew) {
    if (a.feeManual) continue; // valor ajustado à mão não é sobrescrito
    if (a.fee !== null && Number(a.fee) === auto) continue;
    const paid = a.payableId ? await tx.accountPayable.findFirst({ where: { id: a.payableId, status: "PAGO" } }) : null;
    if (paid) continue; // já pago: é histórico
    await tx.captureAssignment.update({ where: { id: a.id }, data: { fee: auto } });
  }
  // Quem recusou não recebe.
  for (const a of capture.assignments.filter((x) => x.status === "RECUSADO" && x.fee !== null && !x.feeManual)) {
    await tx.captureAssignment.update({ where: { id: a.id }, data: { fee: null, payableId: null } });
  }
}

// Mantém todas as folhas da organização em dia. Barato o bastante para rodar
// a cada alteração relevante e na rodada diária.
export async function syncPayroll(organizationId: string) {
  await db.$transaction(
    async (tx) => {
      const now = new Date();
      const current = competenceOf(now);
      const touched = new Set<string>();

      // Folhas antigas (antes desta versão) passam a ser folhas por competência.
      const legacy = await tx.accountPayable.findMany({ where: { organizationId, teamMemberId: { not: null }, kind: null } });
      for (const l of legacy) {
        await tx.accountPayable.update({ where: { id: l.id }, data: { kind: FOLHA, competence: shiftCompetence(competenceOf(l.dueDate), -1) } });
        if (l.status === "PENDENTE" || l.status === "ATRASADO") touched.add(l.id);
      }

      // Comissões liberadas e cachês ainda sem folha → folha do mês em que foram ganhos.
      const looseCommissions = await tx.commission.findMany({ where: { organizationId, status: "A_PAGAR", payableId: null, sellerUserId: { not: null } } });
      for (const c of looseCommissions) {
        const member = await ensureMemberForUser(tx, organizationId, c.sellerUserId!);
        if (!member) continue;
        const folha = await openFolha(tx, member, competenceOf(c.releasedAt ?? now));
        await tx.commission.update({ where: { id: c.id }, data: { payableId: folha.id } });
        touched.add(folha.id);
      }
      const looseFees = await tx.captureAssignment.findMany({ where: { organizationId, fee: { not: null }, payableId: null }, include: { capture: { select: { date: true } } } });
      for (const a of looseFees) {
        const member = await ensureMemberForUser(tx, organizationId, a.userId);
        if (!member) continue;
        const folha = await openFolha(tx, member, competenceOf(a.capture.date));
        await tx.captureAssignment.update({ where: { id: a.id }, data: { payableId: folha.id } });
        touched.add(folha.id);
      }

      // Quem tem salário fixo sempre tem a folha do mês corrente.
      const salaried = await tx.teamMember.findMany({ where: { organizationId, active: true, paymentValue: { gt: 0 } } });
      for (const m of salaried) touched.add((await openFolha(tx, m, current)).id);

      // Recalcula todas as folhas em aberto (valores, vencimento, composição).
      const open = await tx.accountPayable.findMany({ where: { organizationId, kind: FOLHA, status: { in: ["PENDENTE", "ATRASADO"] } }, select: { id: true } });
      for (const o of open) touched.add(o.id);
      for (const id of touched) await recalcFolha(tx, id);
    },
    { timeout: 30_000 },
  );
}

// Quando a folha é paga, as comissões dela ficam pagas (e voltam se o pagamento for desfeito).
export async function onFolhaPaid(tx: Db, payableId: string, paidAt: Date, paidByUserId: string | null) {
  await tx.commission.updateMany({ where: { payableId, status: "A_PAGAR" }, data: { status: "PAGA", paidAt, paidByUserId } });
}

export async function onFolhaUnpaid(tx: Db, payableId: string) {
  await tx.commission.updateMany({ where: { payableId, status: "PAGA" }, data: { status: "A_PAGAR", paidAt: null, paidByUserId: null } });
}

export async function syncAllPayrolls(): Promise<number> {
  const orgs = await db.organization.findMany({ select: { id: true } });
  for (const o of orgs) await syncPayroll(o.id);
  return orgs.length;
}
