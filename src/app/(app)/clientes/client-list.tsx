"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { createClientAction } from "@/lib/actions/client-actions";
import { CLIENT_STATUS_LABELS } from "@/lib/validation/clients";
import { formatCurrency } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientForm } from "./client-form";

interface ClientRow {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  contractsCount: number;
  pendingAmount: number;
}

const STATUS_TONE: Record<string, "success" | "neutral" | "info" | "error"> = {
  ATIVO: "success",
  INATIVO: "neutral",
  PROSPECTO: "info",
  INADIMPLENTE: "error",
};

export function ClientList({
  clients,
  currency,
  permissions,
}: {
  clients: ClientRow[];
  currency: string;
  permissions: { canCreate: boolean; canEdit: boolean };
}) {
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (statusFilter !== "TODOS" && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return c.companyName.toLowerCase().includes(q) || (c.contactName ?? "").toLowerCase().includes(q);
    });
  }, [clients, search, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-tertiary" />
            <Input
              placeholder="Buscar por empresa ou contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full pl-10 sm:w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 rounded-full border border-border bg-card px-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="TODOS">Todos os status</option>
            {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Novo Cliente
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title={clients.length === 0 ? "Nenhum cliente cadastrado ainda" : "Nenhum cliente encontrado"}
          description={
            clients.length === 0
              ? "Cadastre um cliente diretamente ou converta um lead fechado no CRM."
              : "Ajuste a busca ou o filtro de status."
          }
          action={
            permissions.canCreate &&
            clients.length === 0 && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Adicionar cliente
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:hidden">
            {filtered.map((client) => (
              <Link
                key={client.id}
                href={`/clientes/${client.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 active:bg-card-elevated"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-text-primary">{client.companyName}</span>
                  <Badge tone={STATUS_TONE[client.status] ?? "neutral"}>{CLIENT_STATUS_LABELS[client.status as keyof typeof CLIENT_STATUS_LABELS] ?? client.status}</Badge>
                </div>
                {(client.contactName || client.phone) && (
                  <p className="text-sm text-text-secondary">
                    {client.contactName ?? "—"}
                    {client.phone && <span className="text-text-tertiary"> · {client.phone}</span>}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>{client.contractsCount} contrato{client.contractsCount === 1 ? "" : "s"}</span>
                  <span>{client.pendingAmount > 0 ? `Em aberto: ${formatCurrency(client.pendingAmount, currency)}` : "Sem pendências"}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Contratos</th>
                  <th className="px-4 py-3 font-medium">Em aberto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id} className="border-b border-border last:border-0 hover:bg-card">
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${client.id}`} className="font-medium text-text-primary hover:text-accent-light">
                        {client.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {client.contactName ?? "—"}
                      {client.phone && <span className="block text-xs text-text-tertiary">{client.phone}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[client.status] ?? "neutral"}>{CLIENT_STATUS_LABELS[client.status as keyof typeof CLIENT_STATUS_LABELS] ?? client.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{client.contractsCount}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {client.pendingAmount > 0 ? formatCurrency(client.pendingAmount, currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo Cliente">
        <ClientForm action={createClientAction} submitLabel="Cadastrar cliente" onSuccess={() => setCreating(false)} />
      </Drawer>
    </div>
  );
}
