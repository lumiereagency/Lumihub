"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, ArrowUpCircle } from "lucide-react";
import { createPayableAction, updatePayableAction, cancelPayableAction, undoPayablePaymentAction } from "@/lib/actions/payable-actions";
import { PAYABLE_STATUS_LABELS } from "@/lib/validation/payables";
import { formatCurrency, formatDate } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PayableForm, type PayableFormValues } from "./payable-form";
import { ConfirmPayableForm } from "./confirm-payable-form";

interface PayableRow {
  id: string;
  description: string;
  supplier: string | null;
  categoryId: string | null;
  categoryName: string | null;
  costCenterId: string | null;
  amount: number;
  dueDate: string;
  status: string;
  recurring: boolean;
  installmentNumber: number | null;
  installmentTotal: number | null;
  responsibleUserId: string | null;
}

const STATUS_TONE: Record<string, "neutral" | "success" | "error"> = {
  PENDENTE: "neutral",
  PAGO: "success",
  ATRASADO: "error",
  CANCELADO: "neutral",
};

function effectiveStatus(p: PayableRow): string {
  if (p.status === "PENDENTE" && new Date(p.dueDate).getTime() < Date.now()) return "ATRASADO";
  return p.status;
}

function toFormValues(p: PayableRow): PayableFormValues {
  return {
    description: p.description,
    supplier: p.supplier,
    categoryId: p.categoryId,
    costCenterId: p.costCenterId,
    amount: p.amount,
    dueDate: p.dueDate,
    recurring: p.recurring,
    responsibleUserId: p.responsibleUserId,
  };
}

export function PayableList({
  payables,
  categories,
  costCenters,
  users,
  currency,
  permissions,
}: {
  payables: PayableRow[];
  categories: { id: string; name: string }[];
  costCenters: { id: string; name: string }[];
  users: { id: string; name: string }[];
  currency: string;
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return payables.filter((p) => {
      const status = effectiveStatus(p);
      if (statusFilter !== "TODOS" && status !== statusFilter) return false;
      if (search.trim() && !p.description.toLowerCase().includes(search.toLowerCase()) && !(p.supplier ?? "").toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [payables, statusFilter, search]);

  const editing = editingId ? payables.find((p) => p.id === editingId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar descrição ou fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="TODOS">Todos os status</option>
            {Object.entries(PAYABLE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Nova Conta a Pagar
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ArrowUpCircle size={28} />}
          title={payables.length === 0 ? "Nenhuma conta a pagar registrada ainda" : "Nenhuma conta encontrada"}
          action={
            permissions.canCreate &&
            payables.length === 0 && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Nova conta a pagar
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const status = effectiveStatus(p);
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-card">
                    <td className="px-4 py-3">
                      <p className="text-text-primary">{p.description}</p>
                      {p.supplier && <p className="text-xs text-text-tertiary">{p.supplier}</p>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{p.categoryName ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatCurrency(p.amount, currency)}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(new Date(p.dueDate))}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[status] ?? "neutral"}>{PAYABLE_STATUS_LABELS[status as keyof typeof PAYABLE_STATUS_LABELS] ?? status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingId(p.id)}
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

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nova Conta a Pagar">
        <PayableForm
          action={createPayableAction}
          categories={categories}
          costCenters={costCenters}
          users={users}
          showInstallments
          submitLabel="Criar conta a pagar"
          onSuccess={() => setCreating(false)}
        />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing?.description ?? ""}>
        {editing && (
          <div className="flex flex-col gap-4">
            {editing.installmentTotal && editing.installmentTotal > 1 && (
              <p className="text-xs text-text-tertiary">
                Parcela {editing.installmentNumber} de {editing.installmentTotal}
              </p>
            )}
            {(editing.status === "PENDENTE" || editing.status === "ATRASADO") && <ConfirmPayableForm payableId={editing.id} />}
            {editing.status === "PAGO" && (
              <>
                <div className="rounded-[10px] border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">Pago</div>
                {permissions.canEdit && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (confirm("Desfazer o pagamento? A conta volta para pendente e sai do Saldo atual.")) {
                        startTransition(async () => {
                          await undoPayablePaymentAction(editing.id);
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
                <PayableForm
                  key={editing.id}
                  action={updatePayableAction.bind(null, editing.id)}
                  defaultValues={toFormValues(editing)}
                  categories={categories}
                  costCenters={costCenters}
                  users={users}
                  submitLabel="Salvar alterações"
                />
                {permissions.canDelete && (
                  <Button
                    variant="danger"
                    onClick={() =>
                      startTransition(async () => {
                        await cancelPayableAction(editing.id);
                        setEditingId(null);
                      })
                    }
                  >
                    Cancelar conta
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
