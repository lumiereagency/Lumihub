import Link from "next/link";
import { ArrowRight, HandCoins } from "lucide-react";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";

// Bloco de comissões no Dashboard: o vendedor vê as dele; a diretoria vê o
// total que precisa pagar ao time. Some quando ainda não há nenhuma.
export async function CommissionsSummary({ organizationId, userId, director }: { organizationId: string; userId: string; director: boolean }) {
  const where = { organizationId, ...(director ? {} : { sellerUserId: userId }) };
  const groups = await db.commission.groupBy({ by: ["status"], where, _sum: { amount: true }, _count: true });
  if (!groups.length) return null;
  const total = (status: string) => Number(groups.find((g) => g.status === status)?._sum.amount ?? 0);
  const toPay = total("A_PAGAR");
  const waiting = total("AGUARDANDO_CLIENTE");
  const paid = total("PAGA");

  return (
    <Link
      href="/comissoes"
      className="group flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-text-tertiary/60 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success/12 text-success">
          <HandCoins size={20} />
        </span>
        <div>
          <p className="text-[17px] font-semibold tracking-tight text-text-primary">{director ? "Comissões do time" : "Minhas comissões"}</p>
          <p className="text-sm text-text-tertiary">{director ? "Quanto você precisa pagar a quem vendeu" : "Vendas fechadas e o que já está liberado"}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <p className="text-xs text-text-tertiary">{director ? "A pagar agora" : "Liberado"}</p>
          <p className="lb-figures text-xl font-semibold tracking-tight text-text-primary">{formatCurrency(toPay)}</p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary">Aguardando cliente</p>
          <p className="lb-figures text-xl font-semibold tracking-tight text-text-secondary">{formatCurrency(waiting)}</p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary">{director ? "Já pago" : "Já recebido"}</p>
          <p className="lb-figures text-xl font-semibold tracking-tight text-text-secondary">{formatCurrency(paid)}</p>
        </div>
        <ArrowRight size={18} className="hidden text-text-tertiary transition-transform group-hover:translate-x-0.5 sm:block" />
      </div>
    </Link>
  );
}
