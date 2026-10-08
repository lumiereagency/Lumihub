import "server-only";
import { db } from "@/lib/db";
import { generateRemindersForReceivable } from "@/lib/billing/reminders";
import { createContractReceivable } from "@/lib/billing/recurring";
import { brasiliaDay, dueDay, noonOf } from "@/lib/billing/dates";
import type { Prisma } from "@/generated/prisma/client";

// SINCRONIA FINANCEIRA — uma regra só para manter contratos, contas a
// receber, movimentos (o que alimenta Financeiro, impostos, contabilidade)
// e o dashboard falando a mesma coisa. Toda ação que mexe em contrato,
// cliente ou cobrança passa por aqui; a conferência (reconcileFinance)
// roda ao abrir o dashboard e o financeiro e corrige o que ficou para trás.

type Tx = Prisma.TransactionClient;
type Db = typeof db | Tx;

const OPEN = ["PENDENTE", "ATRASADO"] as const;

// Cancela cobranças em aberto (nunca as pagas) junto com o movimento e os lembretes.
// Cobrança em que o cliente já mandou comprovante fica: alguém precisa conferir.
export async function cancelOpenReceivables(tx: Db, where: Prisma.AccountReceivableWhereInput, note: string): Promise<number> {
  const open = await tx.accountReceivable.findMany({
    where: { ...where, status: { in: [...OPEN] }, proofSubmittedAt: null },
    select: { id: true, movementId: true, notes: true },
  });
  if (open.length === 0) return 0;
  const ids = open.map((r) => r.id);
  for (const r of open) {
    await tx.accountReceivable.update({ where: { id: r.id }, data: { status: "CANCELADO", notes: [r.notes, note].filter(Boolean).join("\n") } });
  }
  const movementIds = open.map((r) => r.movementId).filter((x): x is string => !!x);
  if (movementIds.length) await tx.financialMovement.updateMany({ where: { id: { in: movementIds } }, data: { status: "CANCELADO" } });
  await tx.paymentReminder.updateMany({ where: { receivableId: { in: ids }, status: "AGENDADO" }, data: { status: "CANCELADO" } });
  return open.length;
}

const pad = (n: number) => String(n).padStart(2, "0");
const STEP_MONTHS: Record<string, number> = { UNICO: 1, MENSAL: 1, TRIMESTRAL: 3, ANUAL: 12 };

function addMonthsDay(day: string, months: number, wantDay?: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(wantDay ?? d, dim))}`;
}

// Data da próxima cobrança do contrato, por dia do calendário (Brasília):
// o dia do pagamento, se houver; senão o início, avançando ciclo a ciclo,
// nunca antes de hoje (hoje conta).
function contractAnchor(contract: { paymentDay: number | null; startDate: Date; recurrence: string }): Date {
  const today = brasiliaDay(new Date());
  if (contract.paymentDay) {
    const thisMonth = addMonthsDay(`${today.slice(0, 7)}-01`, 0, contract.paymentDay);
    return noonOf(thisMonth >= today ? thisMonth : addMonthsDay(`${today.slice(0, 7)}-01`, 1, contract.paymentDay));
  }
  const step = STEP_MONTHS[contract.recurrence] ?? 1;
  const startDay = dueDay(contract.startDate);
  let d = startDay;
  const dom = Number(startDay.slice(8, 10));
  for (let i = 0; d < today && i < 2400; i++) d = addMonthsDay(startDay, step * (i + 1), dom);
  return noonOf(d);
}

// Deixa as cobranças de um contrato coerentes com o contrato:
//   • excluído, rascunho, aguardando assinatura ou cancelado → cobranças em aberto canceladas;
//   • encerrado → cancela só as que ainda iam vencer (as vencidas continuam devidas);
//   • ativo → garante a primeira cobrança; se valor/datas mudaram, ajusta as em aberto.
export async function syncContractFinance(tx: Db, contractId: string, opts: { termsChanged?: boolean } = {}) {
  const contract = await tx.contract.findUnique({ where: { id: contractId } });
  if (!contract) return;
  const today = brasiliaDay(new Date());

  if (contract.deletedAt || ["RASCUNHO", "AGUARDANDO_ASSINATURA", "CANCELADO"].includes(contract.status)) {
    const why = contract.deletedAt ? "contrato excluído" : contract.status === "CANCELADO" ? "contrato cancelado" : "contrato deixou de estar ativo";
    await cancelOpenReceivables(tx, { contractId }, `Cancelada automaticamente: ${why}.`);
    return;
  }
  if (contract.status === "ENCERRADO") {
    await cancelOpenReceivables(tx, { contractId, dueDate: { gte: noonOf(today) } }, "Cancelada automaticamente: contrato encerrado.");
    return;
  }

  // ATIVO
  const any = await tx.accountReceivable.findFirst({ where: { contractId }, select: { id: true } });
  if (!any) {
    await createContractReceivable(
      tx,
      contract,
      contractAnchor(contract),
      contract.recurrence === "UNICO" ? "Gerado automaticamente na ativação do contrato." : "Primeira cobrança gerada automaticamente na ativação do contrato.",
    );
    return;
  }
  if (!opts.termsChanged) return;

  const start = dueDay(contract.startDate);
  const end = contract.endDate ? dueDay(contract.endDate) : null;
  // Antes do início ou depois do fim do contrato não há cobrança.
  await cancelOpenReceivables(tx, { contractId, dueDate: { lt: noonOf(start) } }, "Cancelada automaticamente: antes do início do contrato.");
  if (end) await cancelOpenReceivables(tx, { contractId, dueDate: { gt: noonOf(end) } }, "Cancelada automaticamente: depois do fim do contrato.");

  const open = await tx.accountReceivable.findMany({
    where: { contractId, status: { in: [...OPEN] }, proofSubmittedAt: null },
    orderBy: { dueDate: "asc" },
  });
  const anchor = contractAnchor(contract);
  // Nada mais em aberto (ex.: o início foi adiado): a cobrança nasce na nova data.
  if (open.length === 0) {
    if (!end || dueDay(anchor) <= end) {
      await createContractReceivable(tx, contract, anchor, "Cobrança refeita após mudança no contrato.");
    }
    return;
  }
  // A próxima cobrança (a primeira que ainda não venceu) segue a nova data do contrato.
  const next = open.find((r) => dueDay(r.dueDate) >= today);
  for (const r of open) {
    const newDue = r.id === next?.id && (!end || dueDay(anchor) <= end) ? anchor : r.dueDate;
    const changedDue = newDue.getTime() !== r.dueDate.getTime();
    const changedAmount = Number(r.amount) !== Number(contract.value);
    if (!changedDue && !changedAmount) continue;
    await tx.accountReceivable.update({ where: { id: r.id }, data: { amount: contract.value, dueDate: newDue, description: `Contrato — ${contract.title}` } });
    if (r.movementId) await tx.financialMovement.update({ where: { id: r.movementId }, data: { amount: contract.value, dueDate: newDue, competenceDate: newDue } });
    if (changedDue) {
      await tx.paymentReminder.deleteMany({ where: { receivableId: r.id, status: "AGENDADO" } });
      await generateRemindersForReceivable(tx, r.id);
    }
  }
}

// Ao mudar a data/valor de uma cobrança de contrato em Contas a receber,
// leva a mudança para o contrato e para as próximas cobranças em aberto.
export async function propagateReceivableToContract(tx: Tx, receivableId: string) {
  const r = await tx.accountReceivable.findUnique({ where: { id: receivableId } });
  if (!r?.contractId) return;
  const contract = await tx.contract.findUnique({ where: { id: r.contractId } });
  if (!contract || contract.deletedAt) return;
  const day = dueDay(r.dueDate);
  const earlier = await tx.accountReceivable.count({ where: { contractId: contract.id, id: { not: r.id }, status: { not: "CANCELADO" }, dueDate: { lt: r.dueDate } } });
  await tx.contract.update({
    where: { id: contract.id },
    data: {
      value: r.amount,
      paymentDay: contract.recurrence === "UNICO" ? contract.paymentDay : Number(day.slice(8, 10)),
      // A primeira cobrança do contrato marca o início dele.
      ...(earlier === 0 ? { startDate: noonOf(day) } : {}),
    },
  });
  // Próximas cobranças em aberto: mesmo dia do mês e mesmo valor.
  const later = await tx.accountReceivable.findMany({
    where: { contractId: contract.id, id: { not: r.id }, status: { in: [...OPEN] }, proofSubmittedAt: null, dueDate: { gt: r.dueDate } },
  });
  const dom = Number(day.slice(8, 10));
  for (const l of later) {
    const [y, m] = dueDay(l.dueDate).split("-").map(Number);
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const newDue = contract.recurrence === "UNICO" ? l.dueDate : noonOf(`${y}-${String(m).padStart(2, "0")}-${String(Math.min(dom, dim)).padStart(2, "0")}`);
    await tx.accountReceivable.update({ where: { id: l.id }, data: { amount: r.amount, dueDate: newDue } });
    if (l.movementId) await tx.financialMovement.update({ where: { id: l.movementId }, data: { amount: r.amount, dueDate: newDue, competenceDate: newDue } });
    if (newDue.getTime() !== l.dueDate.getTime()) {
      await tx.paymentReminder.deleteMany({ where: { receivableId: l.id, status: "AGENDADO" } });
      await generateRemindersForReceivable(tx, l.id);
    }
  }
}

export interface ReconcileReport {
  cancelledFromContracts: number;
  cancelledFromClients: number;
  movementsFixed: number;
  overdueMarked: number;
}

// Conferência geral: corrige o que ficou fora de sincronia (inclusive dados
// antigos, de antes desta regra). Seguro para rodar a qualquer momento.
export async function reconcileFinance(organizationId: string): Promise<ReconcileReport> {
  const report: ReconcileReport = { cancelledFromContracts: 0, cancelledFromClients: 0, movementsFixed: 0, overdueMarked: 0 };
  const today = brasiliaDay(new Date());

  // 1. Cobranças em aberto de contratos excluídos / não ativos.
  const stale = await db.accountReceivable.findMany({
    where: {
      organizationId,
      status: { in: [...OPEN] },
      proofSubmittedAt: null,
      contract: { OR: [{ deletedAt: { not: null } }, { status: { in: ["RASCUNHO", "AGUARDANDO_ASSINATURA", "CANCELADO", "ENCERRADO"] } }] },
    },
    select: { contractId: true },
    distinct: ["contractId"],
  });
  for (const s of stale) {
    if (!s.contractId) continue;
    const before = await db.accountReceivable.count({ where: { contractId: s.contractId, status: { in: [...OPEN] } } });
    await db.$transaction((tx) => syncContractFinance(tx, s.contractId!));
    const after = await db.accountReceivable.count({ where: { contractId: s.contractId, status: { in: [...OPEN] } } });
    report.cancelledFromContracts += before - after;
  }

  // 2. Contratos ativos sem nenhuma cobrança (ex.: ativados pela assinatura).
  const activeNoCharge = await db.contract.findMany({ where: { organizationId, status: "ATIVO", deletedAt: null, accountsReceivable: { none: {} } }, select: { id: true } });
  for (const c of activeNoCharge) await db.$transaction((tx) => syncContractFinance(tx, c.id));

  // 3. Cobranças em aberto de clientes excluídos.
  report.cancelledFromClients = await db.$transaction((tx) =>
    cancelOpenReceivables(tx, { organizationId, client: { deletedAt: { not: null } } }, "Cancelada automaticamente: cliente excluído."),
  );

  // 4. Movimento sempre igual à cobrança/conta de onde veio (status, valor, datas).
  const receivables = await db.accountReceivable.findMany({
    where: { organizationId, movementId: { not: null } },
    select: { status: true, amount: true, dueDate: true, paidAt: true, movement: { select: { id: true, status: true, amount: true, dueDate: true, paidAt: true } } },
  });
  const payables = await db.accountPayable.findMany({
    where: { organizationId, movementId: { not: null } },
    select: { status: true, amount: true, dueDate: true, paidAt: true, movement: { select: { id: true, status: true, amount: true, dueDate: true, paidAt: true } } },
  });
  for (const r of [...receivables, ...payables]) {
    const m = r.movement;
    if (!m) continue;
    const same =
      m.status === r.status &&
      Number(m.amount) === Number(r.amount) &&
      m.dueDate?.getTime() === r.dueDate.getTime() &&
      (m.paidAt?.getTime() ?? null) === (r.paidAt?.getTime() ?? null);
    if (same) continue;
    await db.financialMovement.update({ where: { id: m.id }, data: { status: r.status, amount: r.amount, dueDate: r.dueDate, paidAt: r.paidAt } });
    report.movementsFixed++;
  }

  // 5. Vencidas viram "Atrasado" (e voltam para "Pendente" se a data foi adiada).
  const open = await db.accountReceivable.findMany({ where: { organizationId, status: { in: [...OPEN] } }, select: { id: true, status: true, dueDate: true, movementId: true } });
  for (const r of open) {
    const want = dueDay(r.dueDate) < today ? "ATRASADO" : "PENDENTE";
    if (want === r.status) continue;
    await db.accountReceivable.update({ where: { id: r.id }, data: { status: want } });
    if (r.movementId) await db.financialMovement.update({ where: { id: r.movementId }, data: { status: want } });
    report.overdueMarked++;
  }
  return report;
}

// Conferência ao abrir telas com números (no máximo a cada 20s por empresa)
// e reserva de impostos recalculada quando algo foi corrigido.
const lastRun = new Map<string, number>();
export async function ensureFinanceInSync(organizationId: string): Promise<ReconcileReport | null> {
  const now = Date.now();
  if (now - (lastRun.get(organizationId) ?? 0) < 20_000) return null;
  lastRun.set(organizationId, now);
  try {
    const r = await reconcileFinance(organizationId);
    if (r.cancelledFromContracts + r.cancelledFromClients + r.movementsFixed > 0) {
      const { syncTaxes } = await import("@/lib/finance/taxes");
      await syncTaxes(organizationId);
    }
    return r;
  } catch (e) {
    console.error("[financeiro] conferência falhou", (e as Error).message);
    return null;
  }
}

export async function reconcileAllOrganizations(): Promise<ReconcileReport[]> {
  const orgs = await db.organization.findMany({ select: { id: true } });
  const out: ReconcileReport[] = [];
  for (const o of orgs) out.push(await reconcileFinance(o.id));
  return out;
}
