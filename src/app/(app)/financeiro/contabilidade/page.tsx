import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Receipt, Users, Landmark } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { FINANCE_TABS, filterTabsForUser } from "@/lib/nav";
import { MonthResultPanel } from "@/components/finance/month-result";
import { getMonthResult, monthRange, syncTaxes } from "@/lib/finance/taxes";
import { competenceLabel, competenceOf, shiftCompetence, FOLHA } from "@/lib/payroll/folha";

export default async function AccountingPage({ searchParams }: PageProps<"/financeiro/contabilidade">) {
  const user = await requirePermission(permKey("REPORTS", "EXPORT"));
  const sp = await searchParams;
  const current = competenceOf(new Date());
  const comp = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : shiftCompetence(current, -1);
  await syncTaxes(user.organizationId);
  const { start, end } = monthRange(comp);
  const org = user.organizationId;
  const [result, incomeCount, expenseCount, folhaCount, proofCount] = await Promise.all([
    getMonthResult(org, comp),
    db.financialMovement.count({ where: { organizationId: org, type: "RECEITA", status: "PAGO", paidAt: { gte: start, lt: end } } }),
    db.accountPayable.count({ where: { organizationId: org, status: { not: "CANCELADO" }, dueDate: { gte: start, lt: end }, OR: [{ kind: null }, { kind: { notIn: [FOLHA, "IMPOSTO"] } }] } }),
    db.accountPayable.count({ where: { organizationId: org, kind: FOLHA, competence: comp, status: { not: "CANCELADO" } } }),
    db.document.count({ where: { organizationId: org, category: "COMPROVANTE", createdAt: { gte: start, lt: end } } }),
  ]);
  const label = competenceLabel(comp);
  const items = [
    { icon: Receipt, title: "Receitas", text: `${incomeCount} recebimento(s) com cliente e CNPJ/CPF` },
    { icon: FileSpreadsheet, title: "Despesas", text: `${expenseCount} conta(s) com fornecedor e categoria` },
    { icon: Users, title: "Folha", text: `${folhaCount} pessoa(s): fixo, comissões e extras` },
    { icon: Landmark, title: "Impostos e comprovantes", text: `DAS do mês e ${proofCount} comprovante(s) anexado(s)` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contabilidade"
        description="Tudo o que a contadora precisa de cada mês, pronto para baixar."
        actions={
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <Link href={`?mes=${shiftCompetence(comp, -1)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-card-elevated" aria-label="Mês anterior">
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-[150px] px-2 text-center text-sm font-medium text-text-primary">{label.charAt(0).toUpperCase() + label.slice(1)}</span>
            <Link href={`?mes=${shiftCompetence(comp, 1)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-card-elevated" aria-label="Próximo mês">
              <ChevronRight size={16} />
            </Link>
          </div>
        }
      />
      <SectionTabs tabs={filterTabsForUser(FINANCE_TABS, user.permissions)} />

      <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[17px] font-semibold text-text-primary">Pacote de {label}</p>
          <p className="text-sm text-text-tertiary">Um .zip com as planilhas (abrem direto no Excel) e os comprovantes do mês.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((i) => (
              <div key={i.title} className="flex items-start gap-2.5 text-sm">
                <i.icon size={16} className="mt-0.5 shrink-0 text-accent-light" />
                <span>
                  <span className="text-text-primary">{i.title}</span>
                  <span className="block text-xs text-text-tertiary">{i.text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <a
          href={`/api/financeiro/pacote?mes=${comp}`}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[image:var(--lh-accent-gradient)] px-6 text-sm font-medium text-accent-on shadow-[0_8px_20px_-8px_var(--lh-accent)] hover:brightness-105"
        >
          <Download size={16} /> Baixar pacote do mês
        </a>
      </section>

      <MonthResultPanel r={result} />
    </div>
  );
}
