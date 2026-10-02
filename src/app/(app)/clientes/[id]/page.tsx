import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, FolderKanban, MessagesSquare } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { CONTRACT_STATUS_LABELS } from "@/lib/validation/contracts";
import { CONTACT_OUTCOME_LABELS, type ContactOutcome } from "@/lib/validation/crm";
import { PROJECT_STATUS_LABELS } from "@/lib/validation/projects";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientDetailHeader } from "./client-detail-header";
import { ClientServices } from "./client-services";

const STATUS_TONE: Record<string, "success" | "neutral" | "info" | "error"> = {
  ATIVO: "success",
  INATIVO: "neutral",
  PROSPECTO: "info",
  INADIMPLENTE: "error",
  RASCUNHO: "neutral",
  AGUARDANDO_ASSINATURA: "info",
  ENCERRADO: "neutral",
  CANCELADO: "error",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CLIENT_CREATED: "Cliente cadastrado",
  CLIENT_UPDATED: "Dados do cliente atualizados",
  LEAD_CONVERTED_TO_CLIENT: "Convertido a partir de um lead",
  CONTRACT_CREATED: "Contrato criado",
  CONTRACT_UPDATED: "Contrato atualizado",
  CONTRACT_ACTIVATED: "Contrato ativado — cobrança gerada",
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission(permKey("CLIENTS", "VIEW"));

  const client = await db.client.findFirst({
    where: { id, organizationId: user.organizationId, deletedAt: null },
  });
  if (!client) notFound();

  const [contracts, receivables, receivedTotal, organization, services, clientServices, projects, tasks, sourceLead] = await Promise.all([
    db.contract.findMany({ where: { clientId: client.id, deletedAt: null }, orderBy: { createdAt: "desc" } }),
    db.accountReceivable.findMany({
      where: { clientId: client.id },
      orderBy: { dueDate: "desc" },
      take: 10,
    }),
    db.accountReceivable.aggregate({
      where: { clientId: client.id, status: "PAGO" },
      _sum: { amount: true },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
    db.service.findMany({
      where: { organizationId: user.organizationId, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true },
    }),
    db.clientService.findMany({ where: { clientId: client.id }, select: { serviceId: true } }),
    db.project.findMany({
      where: { clientId: client.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, dueDate: true },
    }),
    db.task.findMany({
      where: { organizationId: user.organizationId, clientId: client.id, archivedAt: null, status: { not: "CONCLUIDA" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
      select: { id: true, title: true, boardId: true, dueDate: true, list: { select: { name: true } } },
    }),
    db.lead.findFirst({ where: { convertedClientId: client.id }, select: { id: true } }),
  ]);

  const salesHistory = sourceLead
    ? await db.auditLog.findMany({
        where: { organizationId: user.organizationId, entityType: "Lead", entityId: sourceLead.id, action: "LEAD_CONTACTED" },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { user: { select: { name: true } } },
      })
    : [];

  const contractIds = contracts.map((c) => c.id);
  const timeline = await db.auditLog.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [
        { entityType: "Client", entityId: client.id },
        { entityType: "Contract", entityId: { in: contractIds.length > 0 ? contractIds : ["__none__"] } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const currency = organization.currency;
  const pendingTotal = receivables
    .filter((r) => r.status === "PENDENTE" || r.status === "ATRASADO")
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const permissions = {
    canEdit: hasPermission(user, permKey("CLIENTS", "EDIT")),
    canDelete: hasPermission(user, permKey("CLIENTS", "DELETE")),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={client.companyName}
        description={client.contactName ?? undefined}
        actions={
          hasPermission(user, permKey("CRM", "CREATE")) && (
            <Link href={`/propostas/nova?client=${client.id}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-ink-on hover:opacity-90">
              <FileText size={16} /> Novo orçamento
            </Link>
          )
        }
      />

      <ClientDetailHeader client={client} permissions={permissions} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Contratos" value={String(contracts.length)} />
        <MetricCard label="Receita recebida" value={formatCurrency(Number(receivedTotal._sum.amount ?? 0), currency)} tone="accent" />
        <MetricCard label="Em aberto" value={formatCurrency(pendingTotal, currency)} />
        <MetricCard label="Margem / Rentabilidade" value="Indisponível" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contratos</CardTitle>
          </CardHeader>
          {contracts.length === 0 ? (
            <EmptyState title="Nenhum contrato para este cliente" description="Crie um contrato na tela de Contratos." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {contracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="text-text-primary">{c.title}</p>
                    <p className="text-xs text-text-tertiary">
                      {formatCurrency(Number(c.value), currency)} · {formatDate(c.startDate)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>
                    {CONTRACT_STATUS_LABELS[c.status as keyof typeof CONTRACT_STATUS_LABELS] ?? c.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financeiro — últimas cobranças</CardTitle>
          </CardHeader>
          {receivables.length === 0 ? (
            <EmptyState title="Nenhuma cobrança registrada" description="Cobranças aparecem aqui quando um contrato é ativado." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {receivables.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="text-text-primary">{r.description}</p>
                    <p className="text-xs text-text-tertiary">Vencimento {formatDate(r.dueDate)}</p>
                  </div>
                  <Badge tone={r.status === "PAGO" ? "success" : r.status === "ATRASADO" ? "error" : "neutral"}>
                    {formatCurrency(Number(r.amount), currency)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ClientServices
        clientId={client.id}
        services={services}
        selectedIds={clientServices.map((cs) => cs.serviceId)}
        canEdit={permissions.canEdit}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban size={16} className="text-text-tertiary" /> Projetos e tarefas
            </CardTitle>
          </CardHeader>
          {projects.length === 0 && tasks.length === 0 ? (
            <EmptyState title="Nada em andamento para este cliente" description="Projetos e cartões de Tarefas ligados a este cliente aparecem aqui." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {projects.map((p) => (
                <Link key={p.id} href={`/projetos/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent-light">
                  <span className="text-text-primary">{p.name}</span>
                  <Badge tone="neutral">{PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS] ?? p.status}</Badge>
                </Link>
              ))}
              {tasks.map((t) => (
                <Link key={t.id} href={`/tarefas?quadro=${t.boardId ?? ""}&cartao=${t.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent-light">
                  <span className="min-w-0 truncate text-text-primary">{t.title}</span>
                  <span className="shrink-0 text-xs text-text-tertiary">
                    {t.list?.name}
                    {t.dueDate && ` · ${formatDate(t.dueDate)}`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessagesSquare size={16} className="text-text-tertiary" /> Histórico comercial
            </CardTitle>
          </CardHeader>
          {salesHistory.length === 0 ? (
            <EmptyState
              title={sourceLead ? "Nenhum contato registrado no CRM" : "Cliente não veio do CRM"}
              description="Os contatos registrados enquanto era lead (o que foi conversado, objeções, próximos passos) aparecem aqui."
            />
          ) : (
            <ol className="flex flex-col gap-3">
              {salesHistory.map((h) => {
                const meta = (h.metadata ?? {}) as Record<string, unknown>;
                return (
                  <li key={h.id} className="text-sm">
                    <p className="text-text-secondary">
                      <span className="font-medium text-text-primary">{h.user?.name ?? "Sistema"}</span> —{" "}
                      {CONTACT_OUTCOME_LABELS[meta.outcome as ContactOutcome] ?? "contato"}
                      <span className="text-xs text-text-tertiary"> · {formatDateTime(h.createdAt)}</span>
                    </p>
                    {typeof meta.note === "string" && <p className="mt-1 whitespace-pre-wrap rounded-2xl bg-card-elevated px-3 py-2 text-text-secondary">{meta.note}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        {timeline.length === 0 ? (
          <EmptyState title="Sem eventos registrados ainda" />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {timeline.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-text-primary">{AUDIT_ACTION_LABELS[event.action] ?? event.action}</span>
                <span className="text-xs text-text-tertiary">{formatDateTime(event.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
