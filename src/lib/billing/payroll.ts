import "server-only";
import { db } from "@/lib/db";
import { nextPaymentDayOnOrAfter } from "@/lib/billing/recurring";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";

type TxClient = Prisma.TransactionClient;

const PAYROLL_CATEGORY_NAME = "Folha de Pagamento";

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function ensurePayrollCategory(tx: TxClient, organizationId: string): Promise<string> {
  const existing = await tx.financialCategory.findFirst({
    where: { organizationId, name: PAYROLL_CATEGORY_NAME, type: "DESPESA" },
  });
  if (existing) return existing.id;

  const created = await tx.financialCategory.create({
    data: { organizationId, name: PAYROLL_CATEGORY_NAME, type: "DESPESA" },
  });
  return created.id;
}

interface TeamMemberLike {
  id: string;
  organizationId: string;
  name: string;
  role: string;
  paymentValue: Prisma.Decimal;
  paymentMethod: PaymentMethod | null;
}

async function createPayrollPayable(tx: TxClient, member: TeamMemberLike, dueDate: Date) {
  const categoryId = await ensurePayrollCategory(tx, member.organizationId);

  const movement = await tx.financialMovement.create({
    data: {
      organizationId: member.organizationId,
      type: "DESPESA",
      amount: member.paymentValue,
      competenceDate: dueDate,
      dueDate,
      categoryId,
      paymentMethod: member.paymentMethod ?? undefined,
      status: "PENDENTE",
      notes: "Folha de pagamento gerada automaticamente.",
    },
  });

  return tx.accountPayable.create({
    data: {
      organizationId: member.organizationId,
      teamMemberId: member.id,
      movementId: movement.id,
      description: `Folha de pagamento — ${member.name} (${member.role})`,
      supplier: member.name,
      categoryId,
      amount: member.paymentValue,
      dueDate,
      status: "PENDENTE",
    },
  });
}

// Aceite de folha (Fase 46): mantém a próxima cobrança de cada membro de
// equipe ativo, com valor e dia de pagamento configurados, sempre em dia —
// gera a primeira ao configurar, e ajusta a que ainda está pendente se o
// valor/dia mudar depois. Nunca mexe em nada já pago.
export async function syncTeamMemberPayable(tx: TxClient, teamMemberId: string) {
  const member = await tx.teamMember.findUniqueOrThrow({ where: { id: teamMemberId } });

  if (!member.active || !member.paymentValue || !member.paymentDay) return;

  const memberLike: TeamMemberLike = {
    id: member.id,
    organizationId: member.organizationId,
    name: member.name,
    role: member.role,
    paymentValue: member.paymentValue,
    paymentMethod: member.paymentMethod,
  };

  const latest = await tx.accountPayable.findFirst({
    where: { teamMemberId },
    orderBy: { dueDate: "desc" },
  });

  if (!latest) {
    await createPayrollPayable(tx, memberLike, nextPaymentDayOnOrAfter(member.paymentDay));
    return;
  }

  // Só reajusta a que ainda está pendente e no futuro — o que já venceu ou
  // foi pago fica como está, é histórico.
  if (latest.status === "PENDENTE" && latest.dueDate >= new Date()) {
    const newDueDate = nextPaymentDayOnOrAfter(member.paymentDay);
    await tx.accountPayable.update({
      where: { id: latest.id },
      data: { amount: member.paymentValue, dueDate: newDueDate },
    });
    if (latest.movementId) {
      await tx.financialMovement.update({
        where: { id: latest.movementId },
        data: { amount: member.paymentValue, dueDate: newDueDate, competenceDate: newDueDate },
      });
    }
  }
}

// Rodada diária (mesmo gatilho de /api/cron/generate-receivables): garante
// que a próxima folha de cada membro ativo esteja materializada com ~35
// dias de folga, sem nunca preencher ciclos que já passaram.
export async function generateDuePayrollPayables(): Promise<number> {
  const today = new Date();
  const horizon = addDays(today, 35);

  const members = await db.teamMember.findMany({
    where: { active: true, paymentValue: { not: null }, paymentDay: { not: null } },
  });

  let created = 0;

  for (const member of members) {
    const latest = await db.accountPayable.findFirst({
      where: { teamMemberId: member.id },
      orderBy: { dueDate: "desc" },
    });
    if (!latest) continue; // a primeira é responsabilidade do create/update do membro

    let nextDue = addMonths(latest.dueDate, 1);
    let guard = 0;

    while (nextDue <= horizon && guard < 24) {
      await db.$transaction(async (tx) => {
        await createPayrollPayable(
          tx,
          {
            id: member.id,
            organizationId: member.organizationId,
            name: member.name,
            role: member.role,
            paymentValue: member.paymentValue!,
            paymentMethod: member.paymentMethod,
          },
          nextDue,
        );
      });
      created++;
      nextDue = addMonths(nextDue, 1);
      guard++;
    }
  }

  return created;
}
