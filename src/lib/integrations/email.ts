import "server-only";

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

interface SendEmailResult {
  delivered: boolean;
  pending: boolean;
}

// Abstração de envio de e-mail (MessagingProvider). Nenhum provedor SMTP/Resend
// está conectado ainda — configure em Configurações → Integrações.
// Enquanto pendente, o conteúdo é registrado apenas no log do servidor
// (nunca exposto ao usuário final) para não vazar a existência de contas
// nem inventar uma entrega que não aconteceu de fato.
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  console.info(
    `[LUMIHUB][email:pendente] Nenhum provedor de e-mail conectado. Mensagem não enviada.\n` +
      `Para: ${input.to}\nAssunto: ${input.subject}\n${input.text}`,
  );
  return { delivered: false, pending: true };
}
