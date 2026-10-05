import "server-only";
import { zipSync, strToU8 } from "fflate";
import { db } from "@/lib/db";
import { readLocalFile } from "@/lib/storage/local";
import { formatDueDate } from "@/lib/billing/dates";
import { FOLHA, competenceLabel, type FolhaBreakdown } from "@/lib/payroll/folha";
import { IMPOSTO, getMonthResult, monthRange } from "@/lib/finance/taxes";

// Pacote do mês para a contabilidade: planilhas (CSV no padrão do Excel
// brasileiro: ";" e vírgula decimal) + comprovantes, num .zip.

const money = (v: number) => v.toFixed(2).replace(".", ",");
const day = (d: Date | null | undefined) => (d ? formatDueDate(d) : "");
const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function csv(header: string[], rows: unknown[][]): Uint8Array {
  const text = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  return strToU8(text);
}

export async function buildAccountingPackage(organizationId: string, comp: string): Promise<{ file: Uint8Array; name: string }> {
  const { start, end } = monthRange(comp);
  const [result, income, payables, folhas, taxes, proofs] = await Promise.all([
    getMonthResult(organizationId, comp),
    db.financialMovement.findMany({
      where: { organizationId, type: "RECEITA", status: "PAGO", paidAt: { gte: start, lt: end } },
      include: { client: { select: { companyName: true, cnpj: true } }, category: { select: { name: true } }, receivable: { select: { description: true } } },
      orderBy: { paidAt: "asc" },
    }),
    db.accountPayable.findMany({
      where: { organizationId, status: { not: "CANCELADO" }, dueDate: { gte: start, lt: end }, OR: [{ kind: null }, { kind: { notIn: [FOLHA, IMPOSTO] } }] },
      include: { category: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    db.accountPayable.findMany({ where: { organizationId, kind: FOLHA, competence: comp, status: { not: "CANCELADO" } }, orderBy: { supplier: "asc" } }),
    db.accountPayable.findMany({ where: { organizationId, kind: IMPOSTO, competence: comp, status: { not: "CANCELADO" } } }),
    db.document.findMany({ where: { organizationId, category: "COMPROVANTE", createdAt: { gte: start, lt: end } }, select: { id: true, name: true, storageKey: true, mimeType: true } }),
  ]);

  const files: Record<string, Uint8Array> = {};
  files["01-resumo.csv"] = csv(
    ["Item", "Valor (R$)"],
    [
      ["Competência", competenceLabel(comp)],
      ["Recebido no mês", money(result.received)],
      [`Imposto Simples (${result.taxRate}%)`, money(result.taxes)],
      ["Custos e despesas", money(result.costs)],
      ["Folha da equipe", money(result.team)],
      ["Resultado", money(result.profit)],
    ],
  );
  files["02-receitas.csv"] = csv(
    ["Data do recebimento", "Cliente", "CNPJ/CPF", "Descrição", "Categoria", "Forma", "Valor (R$)"],
    income.map((m) => [day(m.paidAt), m.client?.companyName ?? "", m.client?.cnpj ?? "", m.receivable?.description ?? m.notes ?? "", m.category?.name ?? "", m.paymentMethod ?? "", money(Number(m.amount))]),
  );
  files["03-despesas.csv"] = csv(
    ["Vencimento", "Pago em", "Fornecedor", "Descrição", "Categoria", "Situação", "Valor (R$)"],
    payables.map((p) => [day(p.dueDate), day(p.paidAt), p.supplier ?? "", p.description, p.category?.name ?? "", p.status, money(Number(p.amount))]),
  );
  files["04-folha.csv"] = csv(
    ["Pessoa", "Fixo (R$)", "Comissões (R$)", "Cachês (R$)", "Total (R$)", "Vencimento", "Pago em", "Situação"],
    folhas.map((f) => {
      const b = (f.breakdown as FolhaBreakdown | null) ?? { fixed: 0, commissions: [], extras: [] };
      return [f.supplier ?? "", money(b.fixed), money(b.commissions.reduce((s, c) => s + c.amount, 0)), money(b.extras.reduce((s, e) => s + e.amount, 0)), money(Number(f.amount)), day(f.dueDate), day(f.paidAt), f.status];
    }),
  );
  files["05-impostos.csv"] = csv(
    ["Guia", "Vencimento", "Pago em", "Situação", "Valor (R$)"],
    taxes.map((t) => [t.description, day(t.dueDate), day(t.paidAt), t.status, money(Number(t.amount))]),
  );

  for (const [i, doc] of proofs.entries()) {
    try {
      const buf = await readLocalFile(organizationId, doc.storageKey);
      const ext = doc.storageKey.includes(".") ? doc.storageKey.slice(doc.storageKey.lastIndexOf(".")) : "";
      const safe = doc.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "comprovante";
      files[`comprovantes/${String(i + 1).padStart(2, "0")}-${safe}${ext}`] = new Uint8Array(buf);
    } catch {
      // arquivo removido do disco: segue sem ele
    }
  }

  return { file: zipSync(files, { level: 6 }), name: `lumiere-contabilidade-${comp}.zip` };
}
