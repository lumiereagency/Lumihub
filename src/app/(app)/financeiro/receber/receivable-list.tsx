"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, ArrowDownCircle, ExternalLink } from "lucide-react";
import { createReceivableAction, updateReceivableAction, cancelReceivableAction, undoPaymentAction } from "@/lib/actions/receivable-actions";
import { RECEIVABLE_STATUS_LABELS } from "@/lib/validation/receivables";
import { formatCurrency, formatDate } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ReceivableForm, type ReceivableFormValues } from "./receivable-form";
import { ConfirmPaymentForm } from "./confirm-payment-form";
import { ChargePanel } from "./charge-panel";

interface ReceivableRow {
  id: string;
  clientId: string;
  contractId: string | null;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  proofUrl: string | null;
  proofSubmittedAt: string | null;
  dueLabel: string;
  notes: string | null;
  clientName: string;
}

const STATUS_TONE: Record<string, "neutral" | "success" | "error" | "warning"> = {
  PENDENTE: "neutral",
  PAGO: "success",
  ATRASADO: "error",
  CANCELADO: "neutral",
};

function effectiveStatus(r: ReceivableRow): string {
  if (r.status === "PENDENTE" && new Date(r.dueDate).getTime() < Date.now()) return "ATRASADO";
  return r.status;
}

function toFormValues(r: ReceivableRow): ReceivableFormValues {
  return {
    clientId: r.clientId,
    contractId: r.contractId,
    description: r.description,
    amount: r.amount,
    dueDate: r.dueDate,
    paymentMethod: r.paymentMethod,
    notes: r.notes,
  };
}

export function ReceivableList({
  receivables,
  clients,
  contracts,
  currency,
  permissions,
}: {
  receivables: ReceivableRow[];
  clients: { id: string; companyName: string }[];
  contracts: { id: string; title: string; clientId: string }[];
  currency: string;
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return receivables.filter((r) => {
      const status = effectiveStatus(r);
      if (statusFilter !== "TODOS" && status !== statusFilter) return false;
      if (search.trim() && !r.clientName.toLowerCase().includes(search.toLowerCase()) && !r.description.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [receivables, statusFilter, search]);

  const editing = editingId ? receivables.find((r) => r.id === editingId) : null;
  const editingContracts = editing ? contracts.filter((c) => c.clientId === editing.clientId) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar cliente ou descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-full sm:w-64" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 rounded-full border border-border bg-card px-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="TODOS">Todos os status</option>
            {Object.entries(RECEIVABLE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setCreating(true)} disabled={clients.length === 0}>
            <Plus size={16} /> Nova cobrança
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ArrowDownCircle size={28} />}
          title={receivables.length === 0 ? "Nenhuma cobrança registrada ainda" : "Nenhuma cobrança encontrada"}
          description={receivables.length === 0 ? "Cobranças aparecem aqui automaticamente quando um contrato é ativado, ou podem ser criadas manualmente." : undefined}
          action={
            permissions.canCreate &&
            receivables.length === 0 && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Nova cobrança
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:hidden">
            {filtered.map((r) => {
              const status = effectiveStatus(r);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setEditingId(r.id)}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left active:bg-card-elevated"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-text-primary">{r.clientName}</span>
                    <Badge tone={STATUS_TONE[status] ?? "neutral"}>{RECEIVABLE_STATUS_LABELS[status as keyof typeof RECEIVABLE_STATUS_LABELS] ?? status}</Badge>
                  </div>
                  <p className="text-sm text-text-secondary">{r.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{formatCurrency(r.amount, currency)}</span>
                    <span className="text-text-tertiary">{r.dueLabel}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const status = effectiveStatus(r);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-card-elevated/50">
                      <td className="px-4 py-3 text-text-primary">{r.clientName}</td>
                      <td className="px-4 py-3 text-text-secondary">{r.description}</td>
                      <td className="px-4 py-3 text-text-secondary">{formatCurrency(r.amount, currency)}</td>
                      <td className="px-4 py-3 text-text-secondary">{r.dueLabel}</td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={STATUS_TONE[status] ?? "neutral"}>{RECEIVABLE_STATUS_LABELS[status as keyof typeof RECEIVABLE_STATUS_LABELS] ?? status}</Badge>
                          {r.proofSubmittedAt && r.status !== "PAGO" && <Badge tone="warning">Comprovante</Badge>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingId(r.id)}
                          className="rounded-[8px] px-2 py-1 text-xs text-text-secondary hover:bg-card-elevated hover:text-text-primary"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nova cobrança">
        <ReceivableForm action={createReceivableAction} clients={clients} contracts={contracts} submitLabel="Criar cobrança" onSuccess={() => setCreating(false)} />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing?.description ?? ""}>
        {editing && (
          <div className="flex flex-col gap-4">
            {(editing.status === "PENDENTE" || editing.status === "ATRASADO") && (
              <>
                {editing.proofSubmittedAt && (
                  <div className="flex flex-col gap-1 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
                    <span>O cliente enviou o comprovante em {formatDate(new Date(editing.proofSubmittedAt))}. Confira e confirme abaixo.</span>
                    {editing.proofUrl && (
                      <a href={editing.proofUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs underline">
                        <ExternalLink size={12} /> Ver comprovante
                      </a>
                    )}
                  </div>
                )}
                <ConfirmPaymentForm receivableId={editing.id} defaultPaymentMethod={editing.paymentMethod} />
                {permissions.canEdit && <ChargePanel key={editing.id} receivableId={editing.id} />}
              </>
            )}
            {editing.status === "PAGO" && (
              <>
                <div className="flex flex-col gap-1 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">
                  <span>Pago em {editing.paidAt ? formatDate(new Date(editing.paidAt)) : "—"}</span>
                  {editing.proofUrl && (
                    <a href={editing.proofUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs underline">
                      <ExternalLink size={12} /> Ver comprovante
                    </a>
                  )}
                </div>
                {permissions.canEdit && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (confirm("Desfazer o pagamento? A cobrança volta para pendente e sai do Saldo atual.")) {
                        startTransition(async () => {
                          await undoPaymentAction(editing.id);
                        });
                      }
                    }}
                  >
                    Desfazer pagamento
                  </Button>
                )}
              </>
            )}

            {(editing.status === "PENDENTE" || editing.status === "ATRASADO") && (
              <>
                <div className="h-px bg-border" />
                <ReceivableForm
                  key={editing.id}
                  action={updateReceivableAction.bind(null, editing.id)}
                  defaultValues={toFormValues(editing)}
                  clients={clients}
                  contracts={editingContracts}
                  submitLabel="Salvar alterações"
                />
                {permissions.canDelete && (
                  <Button
                    variant="danger"
                    onClick={() =>
                      startTransition(async () => {
                        await cancelReceivableAction(editing.id);
                        setEditingId(null);
                      })
                    }
                  >
                    Cancelar cobrança
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
