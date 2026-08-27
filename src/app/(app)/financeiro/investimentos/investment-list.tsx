"use client";

import { useMemo, useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { InvestmentForm } from "./investment-form";

interface InvestmentRow {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  installments: number;
  paymentMethod: string | null;
  objective: string | null;
  expectedReturn: string | null;
}

export function InvestmentList({
  investments,
  currency,
  canCreate,
}: {
  investments: InvestmentRow[];
  currency: string;
  canCreate: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return investments;
    const term = search.toLowerCase();
    return investments.filter((i) => i.description.toLowerCase().includes(term) || i.category.toLowerCase().includes(term));
  }, [investments, search]);

  const total = useMemo(() => investments.reduce((sum, i) => sum + i.amount, 0), [investments]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Buscar descrição ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <p className="text-sm text-text-tertiary">
            Total investido: <span className="font-medium text-text-primary">{formatCurrency(total, currency)}</span>
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Novo Investimento
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={28} />}
          title={investments.length === 0 ? "Nenhum investimento registrado ainda" : "Nenhum investimento encontrado"}
          action={
            canCreate &&
            investments.length === 0 && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Registrar investimento
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Parcelas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-card">
                  <td className="px-4 py-3">
                    <p className="text-text-primary">{i.description}</p>
                    {i.objective && <p className="text-xs text-text-tertiary">{i.objective}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">{i.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatCurrency(i.amount, currency)}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(new Date(i.date))}</td>
                  <td className="px-4 py-3 text-text-secondary">{i.installments > 1 ? `${i.installments}x` : "À vista"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo Investimento">
        <InvestmentForm onSuccess={() => setCreating(false)} />
      </Drawer>
    </div>
  );
}
