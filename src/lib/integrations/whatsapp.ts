import "server-only";

interface SendWhatsAppInput {
  to: string;
  message: string;
}

interface SendResult {
  delivered: boolean;
  pending: boolean;
}

// Abstração de envio de WhatsApp (MessagingProvider). Nenhuma conta do
// WhatsApp Business API está conectada ainda — configure em
// Configurações → Integrações. Enquanto pendente, a mensagem é apenas
// registrada no log do servidor, nunca marcada como entregue de fato.
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendResult> {
  console.info(
    `[LUMIHUB][whatsapp:pendente] Nenhuma conta do WhatsApp Business conectada. Mensagem não enviada.\n` +
      `Para: ${input.to}\n${input.message}`,
  );
  return { delivered: false, pending: true };
}
