import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Poppins } from "next/font/google";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { buildPixCode } from "@/lib/billing/pix";
import { getPixSetup } from "@/lib/billing/charge";
import { brasiliaDay, dueDay, formatDueDate } from "@/lib/billing/dates";
import { groupTiming, openChargesFor } from "@/lib/billing/group";
import { PaymentView } from "./payment-view";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-poppins" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento · Lumière",
  description: "Pague sua fatura com Pix.",
  robots: { index: false, follow: false },
};

export default async function PaymentPage({ params }: PageProps<"/pagar/[token]">) {
  const { token } = await params;
  if (!token || token.length < 16 || token.length > 64) notFound();
  const r = await db.accountReceivable.findUnique({
    where: { publicToken: token },
    include: { client: { select: { companyName: true, contactName: true } }, organization: { select: { currency: true } } },
  });
  if (!r) notFound();

  const pix = await getPixSetup(r.organizationId);
  const currency = r.organization.currency;
  const today = brasiliaDay(new Date());

  // Outras faturas em aberto do mesmo cliente (vencidas ou da mesma semana)
  // aparecem juntas, com um Pix para pagar tudo de uma vez.
  const open = r.status === "PENDENTE" || r.status === "ATRASADO";
  const items = open ? (await openChargesFor(r.id)).items : [];
  const grouped = items.length > 1;
  const amount = grouped ? Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100 : Number(r.amount);
  const code = pix.key ? buildPixCode({ key: pix.key, name: pix.name, city: pix.city, amount, txid: grouped ? `G${r.id}` : r.id }) : null;
  const qrSvg = code ? await QRCode.toString(code, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0B0A08", light: "#FFFFFF" } }) : null;
  const due = dueDay(r.dueDate);
  const timing = grouped ? groupTiming(items) : due < today ? "late" : due === today ? "today" : "upcoming";
  const groupItems = grouped
    ? items.map((i) => {
        const d = dueDay(i.dueDate);
        return {
          id: i.id,
          description: i.description,
          amountLabel: formatCurrency(i.amount, currency),
          dueLabel: d < today ? `venceu em ${formatDueDate(i.dueDate)}` : d === today ? "vence hoje" : `vence em ${formatDueDate(i.dueDate)}`,
          late: d < today,
          pixCode: pix.key ? buildPixCode({ key: pix.key, name: pix.name, city: pix.city, amount: i.amount, txid: i.id }) : null,
        };
      })
    : null;

  return (
    <div className={poppins.variable}>
      <PaymentView
        token={token}
        company={pix.name}
        clientName={(r.client.contactName || r.client.companyName).split(" ")[0]}
        description={grouped ? `${items.length} faturas em aberto` : r.description}
        amountLabel={formatCurrency(amount, currency)}
        dueLabel={formatDueDate(grouped ? items[0].dueDate : r.dueDate)}
        timing={timing}
        items={groupItems}
        status={r.status === "PAGO" ? "paid" : r.status === "CANCELADO" ? "cancelled" : r.proofSubmittedAt ? "proof" : "open"}
        pixKey={pix.key}
        pixCode={code}
        qrSvg={qrSvg}
      />
    </div>
  );
}
