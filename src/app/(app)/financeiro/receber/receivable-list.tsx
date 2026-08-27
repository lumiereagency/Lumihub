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
          <Input placeholder="Buscar cliente ou descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
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
            <Plus size={16} /> Nova Cobrança
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
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
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
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-card">
                    <td className="px-4 py-3 text-text-primary">{r.clientName}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.description}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatCurrency(r.amount, currency)}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(new Date(r.dueDate))}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[status] ?? "neutral"}>{RECEIVABLE_STATUS_LABELS[status as keyof typeof RECEIVABLE_STATUS_LABELS] ?? status}</Badge>
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
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nova Cobrança">
        <ReceivableForm action={createReceivableAction} clients={clients} contracts={contracts} submitLabel="Criar cobrança" onSuccess={() => setCreating(false)} />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing?.description ?? ""}>
        {editing && (
          <div className="flex flex-col gap-4">
            {(editing.status === "PENDENTE" || editing.status === "ATRASADO") && (
              <ConfirmPaymentForm receivableId={editing.id} defaultPaymentMethod={editing.paymentMethod} />
            )}
            {editing.status === "PAGO" && (
              <>
                <div className="flex flex-col gap-1 rounded-[10px] border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">
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
