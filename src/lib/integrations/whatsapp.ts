import "server-only";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integrations/vault";

interface SendWhatsAppInput {
  organizationId: string;
  to: string;
  message: string;
}

interface SendResult {
  delivered: boolean;
  pending: boolean;
  error?: string;
}

async function getWhatsAppCredentials(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "WHATSAPP_BUSINESS" } },
    include: { credentials: true },
  });
  if (!integration || integration.status !== "CONECTADO") return null;

  const config = (integration.config as Record<string, string> | null) ?? {};
  const tokenCredential = integration.credentials.find((c) => c.label === "accessToken");
  if (!tokenCredential || !config.phoneNumberId) return null;

  return {
    phoneNumberId: config.phoneNumberId,
    accessToken: decryptSecret({ encryptedValue: tokenCredential.encryptedValue, iv: tokenCredential.iv, authTag: tokenCredential.authTag }),
  };
}

// Abstração de envio de WhatsApp (MessagingProvider). Só envia de verdade
// quando existe uma Integration WHATSAPP_BUSINESS com status CONECTADO
// (Fase 14); caso contrário, a mensagem é apenas registrada no log do
// servidor, nunca marcada como entregue de fato.
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendResult> {
  const creds = await getWhatsAppCredentials(input.organizationId);
  if (!creds) {
    console.info(
      `[LUMIBASE][whatsapp:pendente] Nenhuma conta do WhatsApp Business conectada. Mensagem não enviada.\n` +
        `Para: ${input.to}\n${input.message}`,
    );
    return { delivered: false, pending: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${creds.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "text",
        text: { body: input.message },
      }),
    });
    if (res.ok) return { delivered: true, pending: false };
    const body = await res.text();
    console.error(`[LUMIBASE][whatsapp:erro] WhatsApp Cloud API recusou o envio (HTTP ${res.status}): ${body}`);
    return { delivered: false, pending: false, error: `HTTP ${res.status}` };
  } catch (err) {
    console.error("[LUMIBASE][whatsapp:erro] Falha ao contatar a WhatsApp Cloud API.", err);
    return { delivered: false, pending: false, error: (err as Error).message };
  }
}
