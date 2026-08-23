import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { toCsv } from "@/lib/reports/csv";
import {
  getFinancialReport,
  getCommercialReport,
  getClientsReport,
  getProjectsReport,
  getTeamReport,
} from "@/lib/reports/queries";
import { CLIENT_STATUS_LABELS } from "@/lib/validation/clients";
import { PROJECT_STATUS_LABELS } from "@/lib/validation/projects";

const REPORT_TYPES = ["financeiro", "comercial", "clientes", "projetos", "equipe"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const money = (v: number) => v.toFixed(2);

async function buildCsv(type: ReportType, organizationId: string): Promise<{ csv: string; filename: string }> {
  switch (type) {
    case "financeiro": {
      const rows = await getFinancialReport(organizationId);
      return {
        csv: toCsv(rows, [
          { key: "category", label: "Categoria" },
          { key: "receita", label: "Receita", format: (v) => money(v as number) },
          { key: "despesa", label: "Despesa", format: (v) => money(v as number) },
        ]),
        filename: "relatorio-financeiro.csv",
      };
    }
    case "comercial": {
      const rows = await getCommercialReport(organizationId);
      return {
        csv: toCsv(rows, [
          { key: "stageLabel", label: "Estágio" },
          { key: "count", label: "Quantidade" },
          { key: "potentialValue", label: "Valor potencial", format: (v) => money(v as number) },
        ]),
        filename: "relatorio-comercial.csv",
      };
    }
    case "clientes": {
      const rows = await getClientsReport(organizationId);
      return {
        csv: toCsv(rows, [
          { key: "companyName", label: "Cliente" },
          { key: "status", label: "Status", format: (v) => CLIENT_STATUS_LABELS[v as keyof typeof CLIENT_STATUS_LABELS] ?? String(v) },
          { key: "contractCount", label: "Contratos" },
          { key: "totalRevenue", label: "Receita total", format: (v) => money(v as number) },
        ]),
        filename: "relatorio-clientes.csv",
      };
    }
    case "projetos": {
      const rows = await getProjectsReport(organizationId);
      return {
        csv: toCsv(rows, [
          { key: "name", label: "Projeto" },
          { key: "clientName", label: "Cliente" },
          { key: "status", label: "Status", format: (v) => PROJECT_STATUS_LABELS[v as keyof typeof PROJECT_STATUS_LABELS] ?? String(v) },
          { key: "value", label: "Valor", format: (v) => money(v as number) },
          { key: "costEstimate", label: "Custo estimado", format: (v) => money(v as number) },
          { key: "teamCost", label: "Custo de equipe", format: (v) => money(v as number) },
          { key: "margin", label: "Margem", format: (v) => money(v as number) },
        ]),
        filename: "relatorio-projetos.csv",
      };
    }
    case "equipe": {
      const rows = await getTeamReport(organizationId);
      return {
        csv: toCsv(rows, [
          { key: "name", label: "Nome" },
          { key: "role", label: "Função" },
          { key: "type", label: "Tipo" },
          { key: "active", label: "Ativo", format: (v) => (v ? "Sim" : "Não") },
          { key: "projectCount", label: "Projetos" },
          { key: "totalCostAllocated", label: "Custo total alocado", format: (v) => money(v as number) },
        ]),
        filename: "relatorio-equipe.csv",
      };
    }
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado.", { status: 401 });
  if (!hasPermission(user, permKey("REPORTS", "EXPORT"))) {
    return new NextResponse("Sem permissão.", { status: 403 });
  }

  const { type } = await params;
  if (!REPORT_TYPES.includes(type as ReportType)) {
    return new NextResponse("Relatório desconhecido.", { status: 404 });
  }

  const { csv, filename } = await buildCsv(type as ReportType, user.organizationId);

  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
