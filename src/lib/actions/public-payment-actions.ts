"use server";

import { db } from "@/lib/db";
import { saveLocalFile } from "@/lib/storage/local";
import { notifyUsers } from "@/lib/notifications/notify";
import { formatCurrency } from "@/lib/format";

// Página pública de pagamento (/pagar/<token>): o token aleatório é a
// credencial. O cliente só consegue anexar comprovante da própria cobrança.

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

export async function submitPaymentProofAction(token: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  if (typeof token !== "string" || token.length < 16 || token.length > 64) return { ok: false, error: "Link inválido." };
  const r = await db.accountReceivable.findUnique({
    where: { publicToken: token },
    include: { client: { select: { companyName: true } }, organization: { select: { currency: true } } },
  });
  if (!r) return { ok: false, error: "Link inválido." };
  if (r.status === "PAGO") return { ok: true };
  if (r.status === "CANCELADO") return { ok: false, error: "Esta cobrança foi cancelada." };
  if (r.proofSubmittedAt && Date.now() - r.proofSubmittedAt.getTime() < 60_000) return { ok: false, error: "Recebemos seu comprovante agora há pouco. Aguarde um instante." };

  const file = formData.get("file");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  let proofUrl = r.proofUrl;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PROOF_BYTES) return { ok: false, error: "O arquivo passa de 10 MB. Envie uma foto ou PDF menor." };
    if (!ALLOWED.includes(file.type)) return { ok: false, error: "Envie uma foto (JPG, PNG) ou um PDF do comprovante." };
    const { storageKey, size } = await saveLocalFile(r.organizationId, file);
    const doc = await db.document.create({
      data: {
        organizationId: r.organizationId,
        clientId: r.clientId,
        name: `Comprovante — ${r.description}`.slice(0, 180),
        category: "COMPROVANTE",
        storageKey,
        mimeType: file.type,
        size,
      },
    });
    proofUrl = `/api/documentos/${doc.id}`;
  } else if (!note) {
    return { ok: false, error: "Anexe o comprovante ou escreva uma mensagem." };
  }

  await db.accountReceivable.update({
    where: { id: r.id },
    data: { proofUrl, proofSubmittedAt: new Date(), notes: note ? [r.notes, `Cliente (${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}): ${note}`].filter(Boolean).join("\n") : r.notes },
  });

  const team = await db.user.findMany({
    where: {
      organizationId: r.organizationId,
      isActive: true,
      deletedAt: null,
      OR: [{ isOwner: true }, { role: { key: "ADMIN" } }, { role: { permissions: { some: { permission: { key: "RECEIVABLES_EDIT" } } } } }],
    },
    select: { id: true },
  });
  await notifyUsers({
    organizationId: r.organizationId,
    userIds: team.map((u) => u.id),
    title: "Comprovante recebido 🧾",
    body: `${r.client.companyName} informou o pagamento de ${formatCurrency(Number(r.amount), r.organization.currency)} (${r.description}). Confira e dê baixa.`,
    link: "/financeiro/receber",
    category: "financeiro",
  });
  return { ok: true };
}
