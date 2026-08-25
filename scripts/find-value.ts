import "dotenv/config";
import { db } from "@/lib/db";

// Investigação só de leitura — não apaga nada. Procura o valor 8.850 em
// Contas a Receber, Contas a Pagar e Movimentos Financeiros pra identificar
// exatamente qual registro está inflando o saldo antes de decidir o que
// remover.
async function main() {
  const amount = 8850;

  const [receivables, payables, movements, contracts] = await Promise.all([
    db.accountReceivable.findMany({
      where: { amount },
      include: { client: { select: { companyName: true } }, contract: { select: { title: true, status: true } } },
    }),
    db.accountPayable.findMany({ where: { amount } }),
    db.financialMovement.findMany({
      where: { amount },
      include: { client: { select: { companyName: true } }, contract: { select: { title: true, status: true } } },
    }),
    db.contract.findMany({
      where: { value: amount },
      include: { client: { select: { companyName: true } } },
    }),
  ]);

  console.log(`\n=== Contas a Receber (amount = ${amount}) — ${receivables.length} ===`);
  for (const r of receivables) {
    console.log(
      `  id=${r.id} status=${r.status} dueDate=${r.dueDate.toISOString().slice(0, 10)} paidAt=${r.paidAt?.toISOString().slice(0, 10) ?? "-"} cliente=${r.client.companyName} contrato=${r.contract?.title ?? "-"} (${r.contract?.status ?? "-"}) descricao="${r.description}"`,
    );
  }

  console.log(`\n=== Contas a Pagar (amount = ${amount}) — ${payables.length} ===`);
  for (const p of payables) {
    console.log(`  id=${p.id} status=${p.status} dueDate=${p.dueDate.toISOString().slice(0, 10)} descricao="${p.description}"`);
  }

  console.log(`\n=== Movimentos Financeiros (amount = ${amount}) — ${movements.length} ===`);
  for (const m of movements) {
    console.log(
      `  id=${m.id} type=${m.type} status=${m.status} competenceDate=${m.competenceDate.toISOString().slice(0, 10)} paidAt=${m.paidAt?.toISOString().slice(0, 10) ?? "-"} cliente=${m.client?.companyName ?? "-"} contrato=${m.contract?.title ?? "-"} (${m.contract?.status ?? "-"}) notas="${m.notes ?? ""}"`,
    );
  }

  console.log(`\n=== Contratos (value = ${amount}) — ${contracts.length} ===`);
  for (const c of contracts) {
    console.log(`  id=${c.id} status=${c.status} cliente=${c.client.companyName} titulo="${c.title}"`);
  }

  console.log("\nFim.");
}

main().then(() => process.exit(0));
