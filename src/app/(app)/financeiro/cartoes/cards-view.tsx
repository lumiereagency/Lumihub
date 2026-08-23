"use client";

import { useState } from "react";
import { Plus, CreditCard as CreditCardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { CardForm } from "./card-form";
import { CardPanel } from "./card-panel";

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
  invoices: InvoiceGroup[];
}

export function CardsView({
  cards,
  currency,
  permissions,
}: {
  cards: CardData[];
  currency: string;
  permissions: { canCreate: boolean; canEdit: boolean };
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {permissions.canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Novo Cartão
          </Button>
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon size={28} />}
          title="Nenhum cartão cadastrado"
          description="Cadastre um cartão para lançar compras e distribuí-las automaticamente nas faturas futuras."
          action={
            permissions.canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Cadastrar cartão
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <CardPanel key={card.id} card={card} invoices={card.invoices} currency={currency} canCreate={permissions.canCreate} canEdit={permissions.canEdit} />
          ))}
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo Cartão">
        <CardForm onSuccess={() => setCreating(false)} />
      </Drawer>
    </div>
  );
}
