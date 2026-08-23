"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CLIENT_STATUS_LABELS } from "@/lib/validation/clients";
import { PROJECT_STATUS_LABELS } from "@/lib/validation/projects";
import { formatCurrency } from "@/lib/format";
import type {
  FinancialReportRow,
  CommercialReportRow,
  ClientReportRow,
  ProjectReportRow,
  TeamReportRow,
} from "@/lib/reports/queries";

interface ReportsData {
  financeiro: FinancialReportRow[];
  comercial: CommercialReportRow[];
  clientes: ClientReportRow[];
  projetos: ProjectReportRow[];
  equipe: TeamReportRow[];
}

const TABS = [
  { key: "financeiro", label: "Financeiro" },
  { key: "comercial", label: "Comercial" },
  { key: "clientes", label: "Clientes" },
  { key: "projetos", label: "Projetos" },
  { key: "equipe", label: "Equipe e margem" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ReportTabs({ data, currency, canExport }: { data: ReportsData; currency: string; canExport: boolean }) {
  const [active, setActive] = useState<TabKey>("financeiro");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-[10px] border border-border bg-card p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={
                active === tab.key
                  ? "rounded-[8px] bg-card-elevated px-3 py-1.5 text-sm font-medium text-text-primary"
                  : "rounded-[8px] px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        {canExport && (
          <a href={`/api/relatorios/${active}`}>
            <Button variant="secondary">
              <Download size={16} /> Exportar CSV
            </Button>
          </a>
        )}
      </div>

      {active === "financeiro" && <FinancialTable rows={data.financeiro} currency={currency} />}
      {active === "comercial" && <CommercialTable rows={data.comercial} currency={currency} />}
      {active === "clientes" && <ClientsTable rows={data.clientes} currency={currency} />}
      {active === "projetos" && <ProjectsTable rows={data.projetos} currency={currency} />}
      {active === "equipe" && <TeamTable rows={data.equipe} currency={currency} />}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-border last:border-0 hover:bg-card">{children}</tr>;
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? "text-text-secondary"}`}>{children}</td>;
}

function FinancialTable({ rows, currency }: { rows: FinancialReportRow[]; currency: string }) {
  if (rows.length === 0) return <EmptyState title="Nenhuma movimentação financeira paga ainda." />;
  return (
    <Table head={["Categoria", "Receita", "Despesa"]}>
      {rows.map((r) => (
        <Row key={r.category}>
          <Cell className="text-text-primary">{r.category}</Cell>
          <Cell className="text-success">{formatCurrency(r.receita, currency)}</Cell>
          <Cell>{formatCurrency(r.despesa, currency)}</Cell>
        </Row>
      ))}
    </Table>
  );
}

function CommercialTable({ rows, currency }: { rows: CommercialReportRow[]; currency: string }) {
  if (rows.length === 0) return <EmptyState title="Nenhum lead cadastrado ainda." />;
  return (
    <Table head={["Estágio", "Quantidade", "Valor potencial"]}>
      {rows.map((r) => (
        <Row key={r.stage}>
          <Cell className="text-text-primary">{r.stageLabel}</Cell>
          <Cell>{r.count}</Cell>
          <Cell>{formatCurrency(r.potentialValue, currency)}</Cell>
        </Row>
      ))}
    </Table>
  );
}

function ClientsTable({ rows, currency }: { rows: ClientReportRow[]; currency: string }) {
  if (rows.length === 0) return <EmptyState title="Nenhum cliente cadastrado ainda." />;
  return (
    <Table head={["Cliente", "Status", "Contratos", "Receita total"]}>
      {rows.map((r) => (
        <Row key={r.clientId}>
          <Cell className="text-text-primary">{r.companyName}</Cell>
          <Cell>
            <Badge tone="neutral">{CLIENT_STATUS_LABELS[r.status as keyof typeof CLIENT_STATUS_LABELS]}</Badge>
          </Cell>
          <Cell>{r.contractCount}</Cell>
          <Cell>{formatCurrency(r.totalRevenue, currency)}</Cell>
        </Row>
      ))}
    </Table>
  );
}

function ProjectsTable({ rows, currency }: { rows: ProjectReportRow[]; currency: string }) {
  if (rows.length === 0) return <EmptyState title="Nenhum projeto cadastrado ainda." />;
  return (
    <Table head={["Projeto", "Cliente", "Status", "Valor", "Custo estimado", "Custo de equipe", "Margem"]}>
      {rows.map((r) => (
        <Row key={r.projectId}>
          <Cell className="text-text-primary">{r.name}</Cell>
          <Cell>{r.clientName}</Cell>
          <Cell>
            <Badge tone="neutral">{PROJECT_STATUS_LABELS[r.status as keyof typeof PROJECT_STATUS_LABELS]}</Badge>
          </Cell>
          <Cell>{formatCurrency(r.value, currency)}</Cell>
          <Cell>{formatCurrency(r.costEstimate, currency)}</Cell>
          <Cell>{formatCurrency(r.teamCost, currency)}</Cell>
          <Cell className={r.margin < 0 ? "text-error" : "text-success"}>{formatCurrency(r.margin, currency)}</Cell>
        </Row>
      ))}
    </Table>
  );
}

function TeamTable({ rows, currency }: { rows: TeamReportRow[]; currency: string }) {
  if (rows.length === 0) return <EmptyState title="Nenhum membro de equipe cadastrado ainda." />;
  return (
    <Table head={["Nome", "Função", "Tipo", "Ativo", "Projetos", "Custo total alocado"]}>
      {rows.map((r) => (
        <Row key={r.teamMemberId}>
          <Cell className="text-text-primary">{r.name}</Cell>
          <Cell>{r.role}</Cell>
          <Cell>{r.type}</Cell>
          <Cell>
            <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Ativo" : "Inativo"}</Badge>
          </Cell>
          <Cell>{r.projectCount}</Cell>
          <Cell>{formatCurrency(r.totalCostAllocated, currency)}</Cell>
        </Row>
      ))}
    </Table>
  );
}
