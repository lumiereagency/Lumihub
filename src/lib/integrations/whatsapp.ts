import "server-only";
import { db } from "@/lib/db";
import { sendWhatsAppBaileysMessage } from "@/lib/integrations/whatsapp-baileys";

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

// Abstração de envio de WhatsApp (MessagingProvider). Só envia de verdade
// quando existe uma Integration WHATSAPP_BUSINESS com status CONECTADO —
// a conexão em si é via Baileys (WebSocket não-oficial pareado por QR
// code em Configurações → Integrações), não a Cloud API oficial da Meta.
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendResult> {
  const integration = await db.integration.findUnique({
    where: { organizationId_provider: { organizationId: input.organizationId, provider: "WHATSAPP_BUSINESS" } },
  });
  if (!integration || integration.status !== "CONECTADO") {
    console.info(
      `[LUMIBASE][whatsapp:pendente] Nenhuma conta do WhatsApp conectada. Mensagem não enviada.\n` +
        `Para: ${input.to}\n${input.message}`,
    );
    return { delivered: false, pending: true };
  }

  return sendWhatsAppBaileysMessage(input.organizationId, input.to, input.message);
}
