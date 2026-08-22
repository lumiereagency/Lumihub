import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/integrations/email";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";

const CHANNEL_PROVIDER = {
  WHATSAPP: "WHATSAPP_BUSINESS",
  EMAIL: "EMAIL_SMTP",
} as const;

// Um canal só é considerado "conectado" quando existe uma Integration real
// com status CONECTADO (Fase 14). Sem isso, o envio é honestamente
// reportado como pendente/falho em vez de fingir uma entrega.
export async function isChannelConnected(organizationId: string, channel: "WHATSAPP" | "EMAIL"): Promise<boolean> {
  const integration = await db.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider: CHANNEL_PROVIDER[channel] } },
  });
  return integration?.status === "CONECTADO";
}

export async function sendReminderMessage(
  organizationId: string,
  channel: "WHATSAPP" | "EMAIL",
  to: string | null,
  subject: string,
  message: string,
): Promise<{ delivered: boolean; error?: string }> {
  const connected = await isChannelConnected(organizationId, channel);
  if (!connected) {
    return { delivered: false, error: "Nenhum canal conectado (Integração pendente em Configurações → Integrações)." };
  }
  if (!to) {
    return { delivered: false, error: "Cliente sem contato cadastrado para este canal." };
  }

  const result =
    channel === "WHATSAPP" ? await sendWhatsApp({ to, message }) : await sendEmail({ to, subject, text: message });

  return result.delivered ? { delivered: true } : { delivered: false, error: "Falha no envio." };
}
