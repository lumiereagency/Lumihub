import "server-only";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { buildPixCode } from "@/lib/billing/pix";
import { appUrl, ensurePublicToken, getPixSetup, type ChargeContext } from "@/lib/billing/charge";
import { addDays, brasiliaDay, dueDay, formatDueDate } from "@/lib/billing/dates";

// Cobrança agrupada por cliente: quando o mesmo cliente tem mais de uma
// fatura para lembrar no dia (ex.: 3 parcelas vencendo em 10/10), sai UMA
// mensagem com todas, o total, um link só e um Pix com o valor total.

// Entram as faturas em aberto já vencidas ou que vencem até 7 dias depois
// da fatura de referência — parcelas futuras do contrato ficam de fora.
const WINDOW_DAYS = 7;

export interface GroupItem {
  id: string;
  description: string;
  amount: number;
  dueDate: Date;
  status: string;
}

export async function openChargesFor(receivableId: string): Promise<{ anchor: GroupItem & { clientId: string; organizationId: string }; items: GroupItem[] }> {
  const r = await db.accountReceivable.findUniqueOrThrow({
    where: { id: receivableId },
    select: { id: true, clientId: true, organizationId: true, description: true, amount: true, dueDate: true, status: true },
  });
  const today = brasiliaDay(new Date());
  const ref = dueDay(r.dueDate) > today ? dueDay(r.dueDate) : today;
  const limit = addDays(ref, WINDOW_DAYS);
  const open = await db.accountReceivable.findMany({
    where: { organizationId: r.organizationId, clientId: r.clientId, status: { in: ["PENDENTE", "ATRASADO"] } },
    select: { id: true, description: true, amount: true, dueDate: true, status: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  const items = open.filter((o) => dueDay(o.dueDate) <= limit).map((o) => ({ ...o, amount: Number(o.amount) }));
  if (!items.some((i) => i.id === r.id) && (r.status === "PENDENTE" || r.status === "ATRASADO")) items.unshift({ ...r, amount: Number(r.amount) });
  return { anchor: { ...r, amount: Number(r.amount) }, items };
}

export function groupTiming(items: GroupItem[]): "late" | "today" | "upcoming" {
  const today = brasiliaDay(new Date());
  if (items.some((i) => dueDay(i.dueDate) < today)) return "late";
  if (items.some((i) => dueDay(i.dueDate) === today)) return "today";
  return "upcoming";
}

// Contexto da cobrança agrupada (mesmo formato da individual, com o total).
export async function buildGroupContext(anchorId: string, items: GroupItem[]): Promise<ChargeContext> {
  const r = await db.accountReceivable.findUniqueOrThrow({
    where: { id: anchorId },
    include: { client: true, organization: { select: { currency: true } } },
  });
  const [token, pix] = await Promise.all([ensurePublicToken(r.id), getPixSetup(r.organizationId)]);
  const total = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  return {
    receivableId: r.id,
    organizationId: r.organizationId,
    phone: r.client.phone,
    email: r.client.email,
    amount: total,
    status: r.status,
    pixSeparate: pix.pixSeparate,
    clientName: (r.client.contactName || r.client.companyName).split(" ")[0],
    valueLabel: formatCurrency(total, r.organization.currency),
    dueDateLabel: formatDueDate(items[0]?.dueDate ?? r.dueDate),
    description: `${items.length} faturas`,
    company: pix.name,
    pixKey: pix.key,
    pixCode: pix.key ? buildPixCode({ key: pix.key, name: pix.name, city: pix.city, amount: total, txid: `G${r.id}` }) : null,
    link: `${appUrl()}/pagar/${token}`,
  };
}

export function groupMessage(ctx: ChargeContext, items: GroupItem[], currency = "BRL"): string {
  const today = brasiliaDay(new Date());
  const timing = groupTiming(items);
  const intro =
    timing === "late"
      ? `Ainda não identificamos o pagamento de algumas faturas com a ${ctx.company}:`
      : timing === "today"
        ? `Passando para lembrar das suas faturas com a ${ctx.company}:`
        : `Passando para lembrar das próximas faturas com a ${ctx.company}:`;
  const lines = items.map((i) => {
    const d = dueDay(i.dueDate);
    const when = d < today ? `venceu em ${formatDueDate(i.dueDate)}` : d === today ? "vence hoje" : `vence em ${formatDueDate(i.dueDate)}`;
    return `• ${i.description} — ${formatCurrency(i.amount, currency)} — ${when}`;
  });
  return [
    `Oi, ${ctx.clientName}! Tudo bem? 😊`,
    intro,
    "",
    ...lines,
    "",
    `Total: ${ctx.valueLabel}`,
    "",
    `Para pagar tudo de uma vez é só abrir: ${ctx.link}`,
    "",
    timing === "late"
      ? "Se já pagou, pode enviar o comprovante pelo mesmo link. Se precisar combinar outra data, é só responder esta mensagem."
      : "Qualquer dúvida, estamos por aqui.",
  ].join("\n");
}
