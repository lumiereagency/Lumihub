import "server-only";
import { db } from "@/lib/db";
import { generateRemindersForReceivable } from "@/lib/billing/reminders";
import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

const RECURRENCE_STEP_MONTHS: Record<string, number> = {
  UNICO: 1,
  MENSAL: 1,
  TRIMESTRAL: 3,
  ANUAL: 12,
};

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Motor de recorrência (Fase 46 — completa a régua de cobrança da Fase 9):
// nunca gera cobrança retroativa. Se a data-âncora já ficou no passado,
// avança ciclo a ciclo (mês a mês / trimestre a trimestre / ano a ano) até
// achar a primeira ocorrência igual ou posterior a hoje.
export function nextCycleOnOrAfter(anchor: Date, recurrence: string, today: Date = new Date()): Date {
  const stepMonths = RECURRENCE_STEP_MONTHS[recurrence] ?? 1;
  let next = new Date(anchor);
  let guard = 0;
  while (next < today && guard < 2400) {
    next = addMonths(next, stepMonths);
    guard++;
  }
  return next;
}

// Início/término do contrato contam só a duração dele — quem ancora a
// cobrança é o dia do pagamento, independente disso. Acha a próxima
// ocorrência desse dia (nesse mês, se ainda não passou; senão, no
// seguinte), com o dia sendo limitado aos dias reais do mês (ex: dia 31
// num mês de 30 dias vira dia 30).
export function nextPaymentDayOnOrAfter(paymentDay: number, today: Date = new Date()): Date {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const day = Math.min(paymentDay, daysInMonth);
  const candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate >= today) return candidate;

  const nextMonthFirst = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const daysInNextMonth = new Date(nextMonthFirst.getFullYear(), nextMonthFirst.getMonth() + 1, 0).getDate();
  return new Date(nextMonthFirst.getFullYear(), nextMonthFirst.getMonth(), Math.min(paymentDay, daysInNextMonth));
}

interface ContractLike {
  id: string;
  organizationId: string;
  clientId: string;
  value: Prisma.Decimal;
  title: string;
}

export async function createContractReceivable(tx: TxClient, contract: ContractLike, dueDate: Date, notes: string) {
  const movement = await tx.financialMovement.create({
    data: {
      organizationId: contract.organizationId,
      type: "RECEITA",
      amount: contract.value,
      competenceDate: dueDate,
      dueDate,
      clientId: contract.clientId,
      contractId: contract.id,
      status: "PENDENTE",
      notes,
    },
  });

  const receivable = await tx.accountReceivable.create({
    data: {
      organizationId: contract.organizationId,
      clientId: contract.clientId,
      contractId: contract.id,
      movementId: movement.id,
      description: `Contrato — ${contract.title}`,
      amount: contract.value,
      dueDate,
      status: "PENDENTE",
    },
  });

  await generateRemindersForReceivable(tx, receivable.id);
  return receivable;
}

// Rodada diária (via /api/cron/generate-receivables): mantém sempre a
// próxima cobrança de cada contrato recorrente ativo já materializada com
// alguma folga (35 dias), o suficiente para aparecer no projetado de 30
// dias do financeiro — sem nunca preencher ciclos que já passaram.
export async function generateDueRecurringReceivables(): Promise<number> {
  const today = new Date();
  const horizon = addDays(today, 35);

  const contracts = await db.contract.findMany({
    where: { status: "ATIVO", recurrence: { not: "UNICO" }, deletedAt: null },
  });

  let created = 0;

  for (const contract of contracts) {
    const latest = await db.accountReceivable.findFirst({
      where: { contractId: contract.id },
      orderBy: { dueDate: "desc" },
    });
    if (!latest) continue; // primeira cobrança é responsabilidade da ativação do contrato

    const stepMonths = RECURRENCE_STEP_MONTHS[contract.recurrence] ?? 1;
    let nextDue = addMonths(latest.dueDate, stepMonths);
    let guard = 0;

    while (nextDue <= horizon && guard < 24) {
      if (contract.endDate && nextDue > contract.endDate) break;

      await db.$transaction(async (tx) => {
        await createContractReceivable(tx, contract, nextDue, "Cobrança recorrente gerada automaticamente.");
      });
      created++;
      nextDue = addMonths(nextDue, stepMonths);
      guard++;
    }
  }

  return created;
}
