// Precisa vir antes de "@/lib/db": ao rodar solto (fora do next start), o
// Next.js não carrega o .env automaticamente como faz em dev/build/start.
import "dotenv/config";
import { db } from "@/lib/db";
import { generateRemindersForReceivable } from "@/lib/billing/reminders";

// Correção pontual (rodar uma única vez): antes desta correção, ativar um
// contrato gerava a cobrança exatamente na data de "Início" informada,
// mesmo quando esse início era retroativo — inflando Contas a Receber (e,
// uma vez marcada como paga, o saldo) com cobranças que nunca foram de
// fato geridas. Esta correção empurra toda cobrança pendente/atrasada
// vinda de contrato para o mesmo dia do mês, só que no próximo mês a
// partir de hoje — zera o "passado" sem mexer em nada que já foi marcado
// como pago manualmente.
function sameDayNextMonth(original: Date, today: Date): Date {
  const targetMonthFirst = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const daysInTargetMonth = new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth() + 1, 0).getDate();
  const day = Math.min(original.getDate(), daysInTargetMonth);
  return new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth(), day);
}

async function main() {
  const today = new Date();

  const affected = await db.accountReceivable.findMany({
    where: { contractId: { not: null }, status: { in: ["PENDENTE", "ATRASADO"] } },
    include: { movement: true },
  });

  console.log(`Encontradas ${affected.length} contas a receber pendentes/atrasadas vindas de contrato.`);

  for (const receivable of affected) {
    const newDueDate = sameDayNextMonth(receivable.dueDate, today);

    await db.$transaction(async (tx) => {
      await tx.accountReceivable.update({
        where: { id: receivable.id },
        data: { dueDate: newDueDate, status: "PENDENTE" },
      });

      if (receivable.movement) {
        await tx.financialMovement.update({
          where: { id: receivable.movement.id },
          data: { dueDate: newDueDate, competenceDate: newDueDate, status: "PENDENTE" },
        });
      }

      await tx.paymentReminder.deleteMany({ where: { receivableId: receivable.id } });
      await generateRemindersForReceivable(tx, receivable.id);
    });

    console.log(
      `  ${receivable.id}: ${receivable.dueDate.toISOString().slice(0, 10)} -> ${newDueDate.toISOString().slice(0, 10)}`,
    );
  }

  console.log("Concluído.");
}

main().then(() => process.exit(0));
