// Precisa vir antes de "@/lib/db": fora do next start, o .env não é carregado sozinho.
import "dotenv/config";
import { db } from "@/lib/db";

// Zera todo o financeiro de UMA organização para recomeçar do zero:
// cobranças (e lembretes da régua), contas a pagar, fluxo de caixa, cartões
// (compras e faturas) e investimentos — e exclui (soft delete) todos os
// contratos. Configurações (modelos de mensagem, categorias, centros de
// custo, modelos de contrato), clientes e metas não são tocados.
//
// Por padrão só mostra o que seria apagado. Para apagar de fato:
//   npx tsx scripts/reset-financeiro.ts --org=<slug> --confirm
// Faça um backup do banco antes (pg_dump) — é irreversível.

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const orgArg = arg("org");

  const orgs = await db.organization.findMany({ select: { id: true, name: true, slug: true } });
  const org = orgArg ? orgs.find((o) => o.slug === orgArg || o.id === orgArg) : orgs.length === 1 ? orgs[0] : undefined;

  if (!org) {
    console.log("Informe a organização com --org=<slug>. Organizações disponíveis:");
    for (const o of orgs) console.log(`  ${o.slug}  (${o.name})`);
    process.exit(1);
  }

  const organizationId = org.id;
  const counts = {
    cobrancas: await db.accountReceivable.count({ where: { organizationId } }),
    lembretes: await db.paymentReminder.count({ where: { receivable: { organizationId } } }),
    contasAPagar: await db.accountPayable.count({ where: { organizationId } }),
    lancamentosFluxoDeCaixa: await db.financialMovement.count({ where: { organizationId } }),
    cartoes: await db.creditCard.count({ where: { organizationId } }),
    investimentos: await db.investment.count({ where: { organizationId } }),
    contratos: await db.contract.count({ where: { organizationId, deletedAt: null } }),
    alertasFinanceirosAbertos: await db.alert.count({
      where: { organizationId, status: "ABERTO", category: { in: ["FINANCEIRO", "CONTRATOS"] } },
    }),
  };

  console.log(`Organização: ${org.name} (${org.slug})`);
  console.table(counts);

  if (!confirm) {
    console.log("Nada foi apagado. Rode de novo com --confirm para apagar.");
    return;
  }

  await db.$transaction(
    async (tx) => {
      await tx.paymentReminder.deleteMany({ where: { receivable: { organizationId } } });
      await tx.accountReceivable.deleteMany({ where: { organizationId } });
      await tx.accountPayable.deleteMany({ where: { organizationId } });
      // Cascata remove compras e parcelas de cada cartão.
      await tx.creditCard.deleteMany({ where: { organizationId } });
      await tx.investment.deleteMany({ where: { organizationId } });
      await tx.financialMovement.deleteMany({ where: { organizationId } });

      const contracts = await tx.contract.findMany({ where: { organizationId, deletedAt: null }, select: { id: true } });
      const contractIds = contracts.map((c) => c.id);
      await tx.calendarEvent.deleteMany({ where: { contractId: { in: contractIds }, type: "CONTRATO" } });
      await tx.contract.updateMany({ where: { id: { in: contractIds } }, data: { deletedAt: new Date() } });

      await tx.alert.updateMany({
        where: { organizationId, status: "ABERTO", category: { in: ["FINANCEIRO", "CONTRATOS"] } },
        data: { status: "RESOLVIDO", resolvedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          action: "FINANCE_RESET",
          entityType: "Organization",
          entityId: organizationId,
          metadata: counts,
        },
      });
    },
    { timeout: 120_000 },
  );

  console.log("Financeiro zerado e contratos excluídos.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
