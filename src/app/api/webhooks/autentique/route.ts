import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { getAutentiqueCredentials, verifyAutentiqueSignature } from "@/lib/integrations/autentique";
import { syncContractSignature } from "@/lib/contracts/signature-sync";

export const runtime = "nodejs";

// Webhook do Autentique (cadastre https://SEU-DOMINIO/api/webhooks/autentique
// no painel, eventos de assinatura e documento finalizado). O corpo só serve
// para descobrir QUAL documento mudou: o estado real é sempre relido na API
// com a chave da Lumière, então um POST forjado não consegue marcar nada
// como assinado. Com o segredo configurado, a assinatura HMAC também é exigida.
export async function POST(request: Request) {
  const raw = await request.text();
  let payload: { event?: { type?: string; data?: { object?: { id?: string }; document?: string } } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const event = payload.event;
  const documentId = typeof event?.data?.document === "string" ? event.data.document : event?.data?.object?.id;
  if (!documentId || typeof documentId !== "string") return NextResponse.json({ ok: true, ignored: true });

  const contract = await db.contract.findUnique({ where: { signatureDocumentId: documentId }, select: { id: true, organizationId: true } });
  if (!contract) return NextResponse.json({ ok: true, ignored: true });

  const credentials = await getAutentiqueCredentials(contract.organizationId);
  if (!credentials) return NextResponse.json({ ok: true, ignored: true });
  if (credentials.webhookSecret && !verifyAutentiqueSignature(raw, request.headers.get("x-autentique-signature"), credentials.webhookSecret)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  await db.integrationLog.create({
    data: {
      organizationId: contract.organizationId,
      integrationId: credentials.integrationId,
      direction: "ENTRADA",
      eventType: `AUTENTIQUE_${(event?.type ?? "evento").toUpperCase().replace(/\W+/g, "_")}`.slice(0, 80),
      status: "SUCESSO",
      payload: { documentId, type: event?.type ?? null },
    },
  });

  // Responde rápido; a sincronização roda em seguida.
  after(() => syncContractSignature(contract.id).catch((err) => console.error("[autentique] falha ao sincronizar", err)));
  return NextResponse.json({ ok: true });
}
