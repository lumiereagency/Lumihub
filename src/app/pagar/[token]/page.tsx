import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Poppins } from "next/font/google";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { buildPixCode } from "@/lib/billing/pix";
import { getPixSetup } from "@/lib/billing/charge";
import { brasiliaDay, dueDay, formatDueDate } from "@/lib/billing/dates";
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
  const amount = Number(r.amount);
  const code = pix.key ? buildPixCode({ key: pix.key, name: pix.name, city: pix.city, amount, txid: r.id }) : null;
  const qrSvg = code ? await QRCode.toString(code, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0B0A08", light: "#FFFFFF" } }) : null;
  const due = dueDay(r.dueDate);
  const today = brasiliaDay(new Date());

  return (
    <div className={poppins.variable}>
      <PaymentView
        token={token}
        company={pix.name}
        clientName={(r.client.contactName || r.client.companyName).split(" ")[0]}
        description={r.description}
        amountLabel={formatCurrency(amount, r.organization.currency)}
        dueLabel={formatDueDate(r.dueDate)}
        timing={due < today ? "late" : due === today ? "today" : "upcoming"}
        status={r.status === "PAGO" ? "paid" : r.status === "CANCELADO" ? "cancelled" : r.proofSubmittedAt ? "proof" : "open"}
        pixKey={pix.key}
        pixCode={code}
        qrSvg={qrSvg}
      />
    </div>
  );
}
