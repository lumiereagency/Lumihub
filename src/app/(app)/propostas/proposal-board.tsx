"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, FileText, AlertCircle } from "lucide-react";
import { PROPOSAL_STATUSES, PROPOSAL_STATUS_LABELS } from "@/lib/validation/proposals";
import { createProposalAction, updateProposalAction, updateProposalStatusAction, deleteProposalAction } from "@/lib/actions/proposal-actions";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProposalForm, type ProposalFormValues } from "./proposal-form";

interface ProposalRow {
  id: string;
  title: string;
  leadId: string | null;
  leadCompany: string | null;
  clientId: string | null;
  clientName: string | null;
  value: number;
  status: string;
  validUntil: string | null;
  sentAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const OPEN_STATUSES = ["RASCUNHO", "ENVIADA", "EM_NEGOCIACAO"];

function toFormValues(p: ProposalRow): ProposalFormValues {
  return { title: p.title, leadId: p.leadId, clientId: p.clientId, value: p.value, validUntil: p.validUntil, notes: p.notes };
}

function isExpired(p: ProposalRow): boolean {
  if (!OPEN_STATUSES.includes(p.status) || p.status === "RASCUNHO") return false;
  if (!p.validUntil) return false;
  return new Date(p.validUntil).getTime() < Date.now();
}

function effectiveStatus(p: ProposalRow): string {
  return isExpired(p) ? "EXPIRADA" : p.status;
}

export function ProposalBoard({
  proposals,
  leads,
  clients,
  currency,
  permissions,
}: {
  proposals: ProposalRow[];
  leads: { id: string; company: string }[];
  clients: { id: string; companyName: string }[];
  currency: string;
  permissions: Permissions;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const editing = editingId ? (proposals.find((p) => p.id === editingId) ?? null) : null;

  const stats = useMemo(() => {
    const open = proposals.filter((p) => OPEN_STATUSES.includes(p.status) && !isExpired(p));
    const pipelineValue = open.reduce((sum, p) => sum + p.value, 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sentThisMonth = proposals.filter((p) => p.sentAt && new Date(p.sentAt) >= monthStart).length;
    const accepted = proposals.filter((p) => p.status === "ACEITA").length;
    const refused = proposals.filter((p) => p.status === "RECUSADA").length;
    const winRate = accepted + refused > 0 ? Math.round((accepted / (accepted + refused)) * 100) : 0;
    const expiringSoon = open.filter((p) => {
      if (!p.validUntil) return false;
      const days = (new Date(p.validUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 7;
    }).length;
    return { pipelineValue, sentThisMonth, winRate, expiringSoon };
  }, [proposals]);

  const columns = useMemo(
    () => PROPOSAL_STATUSES.map((status) => ({ status, items: proposals.filter((p) => effectiveStatus(p) === status) })),
    [proposals],
  );

  function handleStatusChange(proposalId: string, status: string) {
    startTransition(() => updateProposalStatusAction(proposalId, status));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Pipeline de propostas" value={formatCurrency(stats.pipelineValue, currency)} tone="accent" />
        <MetricCard label="Enviadas (mês)" value={String(stats.sentThisMonth)} />
        <MetricCard label="Taxa de aceite" value={`${stats.winRate}%`} />
        <MetricCard label="Expirando em 7 dias" value={String(stats.expiringSoon)} icon={stats.expiringSoon > 0 ? <AlertCircle size={16} /> : undefined} />
      </div>

      {permissions.canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Nova Proposta
          </Button>
        </div>
      )}

      {proposals.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title="Nenhuma proposta cadastrada ainda"
          description="Crie propostas comerciais vinculadas a leads ou clientes e acompanhe o funil até o fechamento."
          action={
            permissions.canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Criar proposta
              </Button>
            )
          }
        />
      ) : (
        <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
          {columns.map((col) => {
            const columnTotal = col.items.reduce((sum, p) => sum + p.value, 0);
            return (
              <div key={col.status} className="flex w-72 shrink-0 flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-text-primary">{PROPOSAL_STATUS_LABELS[col.status as keyof typeof PROPOSAL_STATUS_LABELS]}</span>
                  <span className="text-xs text-text-tertiary">{col.items.length}</span>
                </div>
                <span className="-mt-2 px-1 text-xs text-text-tertiary">{formatCurrency(columnTotal, currency)}</span>
                <div className="flex flex-col gap-2">
                  {col.items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEditingId(p.id)}
                      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:border-accent/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-text-primary">{p.title}</span>
                        {isExpired(p) && <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning" />}
                      </div>
                      <span className="text-xs text-text-tertiary">{p.leadCompany ?? p.clientName ?? "Sem vínculo"}</span>
                      <Badge tone="accent">{formatCurrency(p.value, currency)}</Badge>
                      <div className="flex items-center justify-between text-xs text-text-tertiary">
                        <span>{p.validUntil ? `Válida até ${formatDate(new Date(p.validUntil))}` : "Sem validade definida"}</span>
                      </div>
                      {permissions.canEdit && (
                        <select
                          value={p.status}
                          disabled={isPending}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(p.id, e.target.value);
                          }}
                          className="mt-1 h-8 rounded-[8px] border border-border bg-card-elevated px-2 text-xs text-text-secondary"
                        >
                          {PROPOSAL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              Mover para: {PROPOSAL_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nova Proposta">
        <ProposalForm action={createProposalAction} leads={leads} clients={clients} submitLabel="Criar proposta" onSuccess={() => setCreating(false)} />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing?.title ?? ""}>
        {editing && (
          <div className="flex flex-col gap-6">
            <ProposalForm
              key={editing.id}
              action={updateProposalAction.bind(null, editing.id)}
              defaultValues={toFormValues(editing)}
              leads={leads}
              clients={clients}
              submitLabel="Salvar alterações"
            />
            {permissions.canDelete && (
              <div className={cn("flex flex-col gap-2 border-t border-border pt-4")}>
                <Button
                  variant="danger"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteProposalAction(editing.id);
                      setEditingId(null);
                    })
                  }
                >
                  Excluir proposta
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
