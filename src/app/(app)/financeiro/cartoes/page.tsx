import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { CardsView } from "./cards-view";

export default async function CardsPage() {
  const user = await requirePermission(permKey("CARDS", "VIEW"));

  const [cards, organization] = await Promise.all([
    db.creditCard.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      include: {
        transactions: {
          include: { installments: { orderBy: { invoiceMonth: "asc" } } },
        },
      },
    }),
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } }),
  ]);

  const cardsWithInvoices = cards.map((card) => {
    const groups = new Map<string, { monthKey: string; monthLabel: string; total: number; items: { id: string; number: number; amount: number; paid: boolean; description: string }[] }>();

    for (const tx of card.transactions) {
      for (const inst of tx.installments) {
        const key = format(inst.invoiceMonth, "yyyy-MM");
        if (!groups.has(key)) {
          groups.set(key, { monthKey: key, monthLabel: format(inst.invoiceMonth, "MMMM yyyy", { locale: ptBR }), total: 0, items: [] });
        }
        const group = groups.get(key)!;
        group.total += Number(inst.amount);
        group.items.push({
          id: inst.id,
          number: inst.number,
          amount: Number(inst.amount),
          paid: inst.paid,
          description: tx.installmentsTotal > 1 ? `${tx.description} (${inst.number}/${tx.installmentsTotal})` : tx.description,
        });
      }
    }

    return {
      id: card.id,
      name: card.name,
      institution: card.institution,
      limitAmount: card.limitAmount ? Number(card.limitAmount) : null,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      active: card.active,
      invoices: [...groups.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    };
  });

  const permissions = {
    canCreate: hasPermission(user, permKey("CARDS", "CREATE")),
    canEdit: hasPermission(user, permKey("CARDS", "EDIT")),
  };

  return (
    <div>
      <PageHeader title="Cartões" description="Cartões de crédito, compras parceladas e distribuição automática nas faturas." />
      <CardsView cards={cardsWithInvoices} currency={organization.currency} permissions={permissions} />
    </div>
  );
}
