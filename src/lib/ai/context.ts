import "server-only";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { getFinanceOverview } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth/session";

// Contexto real do sistema, filtrado pelas permissões do usuário atual —
// nunca um resumo genérico. Cada seção só é incluída se o usuário tiver a
// permissão de VIEW do módulo correspondente, para que a Lumi AI nunca
// revele dados que o usuário não poderia ver na própria interface.
export async function buildSystemContext(user: CurrentUser, organizationName: string): Promise<string> {
  const sections: string[] = [
    `Você é a Lumi AI, assistente interna do LUMIHUB para a organização "${organizationName}".`,
    `Responda sempre em português do Brasil, de forma direta e objetiva.`,
    `Use apenas os dados reais listados abaixo — nunca invente números, nomes ou datas. Se a pergunta exigir um dado que não está listado, diga claramente que não tem acesso a essa informação em vez de estimar.`,
    `O usuário atual é ${user.name} (perfil: ${user.role.name}). Os dados abaixo já respeitam as permissões desse perfil.`,
  ];

  if (hasPermission(user, permKey("FINANCE", "VIEW"))) {
    const overview = await getFinanceOverview(user.organizationId);
    sections.push(
      [
        "Financeiro:",
        `saldo atual ${formatCurrency(overview.kpis.saldoAtual, "BRL")}`,
        `receita do mês ${formatCurrency(overview.kpis.receitaMes, "BRL")}`,
        `despesas do mês ${formatCurrency(overview.kpis.despesaMes, "BRL")}`,
        `a receber ${formatCurrency(overview.kpis.aReceber, "BRL")}`,
        `a pagar ${formatCurrency(overview.kpis.aPagar, "BRL")}`,
        `em atraso ${formatCurrency(overview.kpis.atrasados, "BRL")}`,
        `margem ${overview.indicators.margem.toFixed(1)}%`,
      ].join(", "),
    );
  }

  if (hasPermission(user, permKey("CRM", "VIEW"))) {
    const leads = await db.lead.groupBy({
      by: ["stage"],
      where: { organizationId: user.organizationId, deletedAt: null },
      _count: true,
    });
    const total = leads.reduce((sum, l) => sum + l._count, 0);
    sections.push(
      `CRM: ${total} lead(s) no pipeline${leads.length ? " — " + leads.map((l) => `${l.stage}: ${l._count}`).join(", ") : ""}.`,
    );
  }

  if (hasPermission(user, permKey("CLIENTS", "VIEW"))) {
    const total = await db.client.count({ where: { organizationId: user.organizationId, deletedAt: null } });
    sections.push(`Clientes: ${total} cliente(s) cadastrado(s).`);
  }

  if (hasPermission(user, permKey("PROJECTS", "VIEW"))) {
    const projects = await db.project.groupBy({
      by: ["status"],
      where: { organizationId: user.organizationId, deletedAt: null },
      _count: true,
    });
    sections.push(
      `Projetos: ${projects.length ? projects.map((p) => `${p.status}: ${p._count}`).join(", ") : "nenhum projeto cadastrado"}.`,
    );
  }

  if (hasPermission(user, permKey("GOALS", "VIEW"))) {
    const goalCount = await db.goal.count({ where: { organizationId: user.organizationId } });
    sections.push(`Metas: ${goalCount} meta(s) cadastrada(s).`);
  }

  if (hasPermission(user, permKey("RECEIVABLES", "VIEW"))) {
    const overdue = await db.accountReceivable.count({ where: { organizationId: user.organizationId, status: "ATRASADO" } });
    sections.push(`Cobranças em atraso: ${overdue}.`);
  }

  return sections.join("\n");
}
