import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integrations/vault";

interface SendEmailInput {
  organizationId: string;
  to: string;
  subject: string;
  text: string;
}

interface SendEmailResult {
  delivered: boolean;
  pending: boolean;
  error?: string;
}

async function getSmtpCredentials(organizationId: string) {
  const integration = await db.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "EMAIL_SMTP" } },
    include: { credentials: true },
  });
  if (!integration || integration.status !== "CONECTADO") return null;

  const config = (integration.config as Record<string, string> | null) ?? {};
  const passCredential = integration.credentials.find((c) => c.label === "pass");
  if (!passCredential || !config.host || !config.user) return null;

  return {
    host: config.host,
    port: Number(config.port) || 587,
    user: config.user,
    fromAddress: config.fromAddress || config.user,
    pass: decryptSecret({ encryptedValue: passCredential.encryptedValue, iv: passCredential.iv, authTag: passCredential.authTag }),
  };
}

// Abstração de envio de e-mail (MessagingProvider). Só envia de verdade quando
// existe uma Integration EMAIL_SMTP com status CONECTADO (Fase 14); caso
// contrário, a mensagem é apenas registrada no log do servidor, nunca
// marcada como entregue sem uma entrega real.
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const creds = await getSmtpCredentials(input.organizationId);
  if (!creds) {
    console.info(
      `[LUMIHUB][email:pendente] Nenhum provedor de e-mail conectado. Mensagem não enviada.\n` +
        `Para: ${input.to}\nAssunto: ${input.subject}\n${input.text}`,
    );
    return { delivered: false, pending: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.port === 465,
      auth: { user: creds.user, pass: creds.pass },
    });
    await transporter.sendMail({ from: creds.fromAddress, to: input.to, subject: input.subject, text: input.text });
    return { delivered: true, pending: false };
  } catch (err) {
    console.error("[LUMIHUB][email:erro] Falha ao enviar e-mail via SMTP conectado.", err);
    return { delivered: false, pending: false, error: (err as Error).message };
  }
}
