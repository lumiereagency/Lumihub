import "dotenv/config";
import { db } from "@/lib/db";

// Investigação só de leitura — lista tudo que está marcado como PAGO, que é
// exatamente o que compõe o "Saldo atual" (soma de recebíveis pagos menos
// pagáveis pagos). O 8.850 não bate com nenhum registro isolado, então é a
// soma de vários — isso mostra a composição completa.
async function main() {
  const [paidReceivables, paidPayables] = await Promise.all([
    db.accountReceivable.findMany({
      where: { status: "PAGO" },
      include: { client: { select: { companyName: true } }, contract: { select: { title: true, status: true } } },
      orderBy: { paidAt: "asc" },
    }),
    db.accountPayable.findMany({ where: { status: "PAGO" }, orderBy: { paidAt: "asc" } }),
  ]);

  let totalReceived = 0;
  console.log(`\n=== Contas a Receber PAGAS — ${paidReceivables.length} ===`);
  for (const r of paidReceivables) {
    totalReceived += Number(r.amount);
    console.log(
      `  id=${r.id} valor=${r.amount} paidAt=${r.paidAt?.toISOString().slice(0, 10) ?? "-"} dueDate=${r.dueDate.toISOString().slice(0, 10)} cliente=${r.client.companyName} contrato=${r.contract?.title ?? "-"} (${r.contract?.status ?? "-"}) descricao="${r.description}" criado=${r.createdAt.toISOString().slice(0, 10)}`,
    );
  }
  console.log(`  TOTAL RECEBIDO: ${totalReceived}`);

  let totalPaid = 0;
  console.log(`\n=== Contas a Pagar PAGAS — ${paidPayables.length} ===`);
  for (const p of paidPayables) {
    totalPaid += Number(p.amount);
    console.log(
      `  id=${p.id} valor=${p.amount} paidAt=${p.paidAt?.toISOString().slice(0, 10) ?? "-"} dueDate=${p.dueDate.toISOString().slice(0, 10)} descricao="${p.description}" criado=${p.createdAt.toISOString().slice(0, 10)}`,
    );
  }
  console.log(`  TOTAL PAGO: ${totalPaid}`);

  console.log(`\nSaldo atual (recebido - pago) = ${totalReceived - totalPaid}`);
  console.log("\nFim.");
}

main().then(() => process.exit(0));
