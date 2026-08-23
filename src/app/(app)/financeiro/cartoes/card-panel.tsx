"use client";

import { useState, useTransition } from "react";
import { Plus, CreditCard as CreditCardIcon } from "lucide-react";
import { toggleInstallmentPaidAction } from "@/lib/actions/card-actions";
import { formatCurrency } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionForm } from "./transaction-form";

interface InstallmentItem {
  id: string;
  number: number;
  amount: number;
  paid: boolean;
  description: string;
}

interface InvoiceGroup {
  monthKey: string;
  monthLabel: string;
  total: number;
  items: InstallmentItem[];
}

interface CardData {
  id: string;
  name: string;
  institution: string | null;
  limitAmount: number | null;
  closingDay: number;
  dueDay: number;
  active: boolean;
}

export function CardPanel({
  card,
  invoices,
  currency,
  canCreate,
  canEdit,
}: {
  card: CardData;
  invoices: InvoiceGroup[];
  currency: string;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <CreditCardIcon size={16} className="text-gold" /> {card.name}
          </CardTitle>
          <p className="mt-1 text-xs text-text-tertiary">
            {card.institution ?? "Instituição não informada"} · Fecha dia {card.closingDay} · Vence dia {card.dueDay}
            {card.limitAmount != null && ` · Limite ${formatCurrency(card.limitAmount, currency)}`}
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> Nova compra
          </Button>
        )}
      </CardHeader>

      {invoices.length === 0 ? (
        <EmptyState title="Nenhuma compra lançada neste cartão" />
      ) : (
        <div className="flex flex-col gap-4">
          {invoices.map((invoice) => (
            <div key={invoice.monthKey} className="rounded-[10px] border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium capitalize text-text-primary">{invoice.monthLabel}</span>
                <Badge tone="gold">{formatCurrency(invoice.total, currency)}</Badge>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {invoice.items.map((item) => (
                  <label key={item.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2 text-text-secondary">
                      <input
                        type="checkbox"
                        checked={item.paid}
                        disabled={!canEdit}
                        onChange={(e) => startTransition(() => toggleInstallmentPaidAction(item.id, e.target.checked))}
                        className="h-4 w-4 rounded border-border bg-card accent-[#C9A45C]"
                      />
                      {item.description}
                    </span>
                    <span className={item.paid ? "text-success" : "text-text-secondary"}>{formatCurrency(item.amount, currency)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title={`Nova compra — ${card.name}`}>
        <TransactionForm cardId={card.id} onSuccess={() => setCreating(false)} />
      </Drawer>
    </Card>
  );
}
