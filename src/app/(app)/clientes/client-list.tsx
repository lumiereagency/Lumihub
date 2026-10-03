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
import { MetricCard } from "@/components/ui/metric-card";
import { cn } from "@/lib/cn";
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

  const counts = useMemo(() => {
    const map: Record<string, number> = { TODOS: clients.length };
    for (const c of clients) map[c.status] = (map[c.status] ?? 0) + 1;
    return map;
  }, [clients]);
  const pendingTotal = clients.reduce((sum, c) => sum + c.pendingAmount, 0);

  return (
    <div className="flex flex-col gap-5">
      {clients.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Clientes ativos" value={String(counts.ATIVO ?? 0)} icon={<Users />} tone="accent" caption={`${clients.length} no total`} />
          <MetricCard label="Inadimplentes" value={String(counts.INADIMPLENTE ?? 0)} caption="com cobrança atrasada" />
          <MetricCard label="Em aberto" value={formatCurrency(pendingTotal, currency)} caption="cobranças pendentes" />
          <MetricCard label="Prospectos" value={String(counts.PROSPECTO ?? 0)} caption="ainda sem contrato" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-tertiary" />
            <Input
              placeholder="Buscar por empresa ou contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full pl-10 sm:w-64"
            />
          </div>
          <div className="scrollbar-thin -mx-1 flex max-w-[calc(100%+0.5rem)] gap-1.5 overflow-x-auto px-1">
            {[["TODOS", "Todos"], ...Object.entries(CLIENT_STATUS_LABELS)].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={statusFilter === value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  statusFilter === value ? "border-transparent bg-ink text-ink-on" : "border-border bg-card text-text-secondary hover:text-text-primary",
                )}
              >
                {label}
                <span className={cn("lb-figures text-xs", statusFilter === value ? "opacity-70" : "text-text-tertiary")}>{counts[value] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Novo cliente
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
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Contratos</th>
                  <th className="px-4 py-3 font-medium">Em aberto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id} className="border-b border-border last:border-0 hover:bg-card-elevated/50">
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${client.id}`} className="flex items-center gap-3 font-medium text-text-primary hover:text-accent-light">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/12 text-xs font-semibold text-accent-light">
                          {client.companyName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
                        </span>
                        <span className="truncate">{client.companyName}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {client.contactName ?? "—"}
                      {client.phone && <span className="block text-xs text-text-tertiary">{client.phone}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[client.status] ?? "neutral"}>{CLIENT_STATUS_LABELS[client.status as keyof typeof CLIENT_STATUS_LABELS] ?? client.status}</Badge>
                    </td>
                    <td className="lb-figures px-4 py-3 text-text-secondary">{client.contractsCount}</td>
                    <td className="lb-figures px-4 py-3 text-text-secondary">
                      {client.pendingAmount > 0 ? formatCurrency(client.pendingAmount, currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo cliente">
        <ClientForm action={createClientAction} submitLabel="Cadastrar cliente" onSuccess={() => setCreating(false)} />
      </Drawer>
    </div>
  );
}
