import { z } from "zod";

export const MESSAGE_TRIGGERS = ["D_MENOS_7", "D_MENOS_3", "D_MENOS_1", "D_0", "D_MAIS_1", "D_MAIS_5"] as const;

// Linguagem simples em vez da notação "D-3/D0/D+1" (§ pedido do usuário:
// "tem D mais, D mais, eu não entendo muito disso") — o valor salvo no
// banco continua o mesmo enum, só a label mudou.
export const MESSAGE_TRIGGER_LABELS: Record<(typeof MESSAGE_TRIGGERS)[number], string> = {
  D_MENOS_7: "7 dias antes do vencimento",
  D_MENOS_3: "3 dias antes do vencimento",
  D_MENOS_1: "1 dia antes do vencimento",
  D_0: "No dia do vencimento",
  D_MAIS_1: "1 dia depois do vencimento",
  D_MAIS_5: "5 dias depois do vencimento",
};

export const TRIGGER_OFFSET_DAYS: Record<(typeof MESSAGE_TRIGGERS)[number], number> = {
  D_MENOS_7: -7,
  D_MENOS_3: -3,
  D_MENOS_1: -1,
  D_0: 0,
  D_MAIS_1: 1,
  D_MAIS_5: 5,
};

export const REMINDER_CHANNELS = ["WHATSAPP", "EMAIL"] as const;

export const REMINDER_CHANNEL_LABELS: Record<(typeof REMINDER_CHANNELS)[number], string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
};

export const REMINDER_STATUS_LABELS: Record<string, string> = {
  AGENDADO: "Agendado",
  ENVIADO: "Enviado",
  FALHOU: "Falhou",
  CANCELADO: "Cancelado",
};

export const messageTemplateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do modelo."),
  trigger: z.enum(MESSAGE_TRIGGERS).default("D_0"),
  channel: z.enum(REMINDER_CHANNELS).default("WHATSAPP"),
  body: z.string().trim().min(1, "Informe o texto da mensagem."),
  active: z.boolean().default(true),
});

export const TEMPLATE_PLACEHOLDERS: { key: string; description: string }[] = [
  { key: "{{nome}}", description: "Primeiro nome do cliente" },
  { key: "{{valor}}", description: "Valor da cobrança" },
  { key: "{{vencimento}}", description: "Data de vencimento" },
  { key: "{{descricao}}", description: "Descrição da cobrança (ex: Mensalidade outubro)" },
  { key: "{{link}}", description: "Link de pagamento: QR code, Pix copia e cola e envio de comprovante" },
  { key: "{{pix}}", description: "Chave Pix" },
  { key: "{{pix_copia_cola}}", description: "Código Pix copia e cola com o valor exato" },
  { key: "{{empresa}}", description: "Nome da empresa que recebe" },
];

export interface ChargeMessageValues {
  clientName: string;
  valueLabel: string;
  dueDateLabel: string;
  description: string;
  link: string;
  company: string;
  pixKey: string | null;
  pixCode: string | null;
}

export function renderMessageBody(template: string, v: ChargeMessageValues): string {
  return template
    .replaceAll("{{nome}}", v.clientName)
    .replaceAll("{{valor}}", v.valueLabel)
    .replaceAll("{{vencimento}}", v.dueDateLabel)
    .replaceAll("{{descricao}}", v.description)
    .replaceAll("{{link}}", v.link)
    .replaceAll("{{empresa}}", v.company)
    .replaceAll("{{pix_copia_cola}}", v.pixCode ?? v.link)
    .replaceAll("{{pix}}", v.pixKey ?? v.link);
}

// Modelos prontos da régua (WhatsApp). O código Pix vai numa mensagem
// separada logo depois, para o cliente copiar com um toque.
export const DEFAULT_MESSAGE_TEMPLATES: { name: string; trigger: (typeof MESSAGE_TRIGGERS)[number]; body: string }[] = [
  {
    name: "Lembrete amigável",
    trigger: "D_MENOS_3",
    body: "Oi, {{nome}}! Tudo bem? 😊\nPassando para lembrar que a fatura de {{descricao}}, no valor de {{valor}}, vence em {{vencimento}}.\n\nPara pagar é só abrir: {{link}}\nO código Pix copia e cola vai na próxima mensagem.\n\nQualquer dúvida, estamos por aqui. {{empresa}}",
  },
  {
    name: "Vence hoje",
    trigger: "D_0",
    body: "Oi, {{nome}}! A fatura de {{descricao}}, no valor de {{valor}}, vence hoje.\n\nPara pagar é só abrir: {{link}}\nO código Pix copia e cola vai na próxima mensagem.\n\nSe já pagou, pode desconsiderar. Obrigado!",
  },
  {
    name: "Venceu ontem",
    trigger: "D_MAIS_1",
    body: "Oi, {{nome}}, tudo bem? Ainda não identificamos o pagamento da fatura de {{descricao}} ({{valor}}), que venceu ontem.\n\nPara pagar é só abrir: {{link}}\nO código Pix copia e cola vai na próxima mensagem.\n\nSe já pagou, pode enviar o comprovante pelo mesmo link.",
  },
  {
    name: "Em aberto há 5 dias",
    trigger: "D_MAIS_5",
    body: "Oi, {{nome}}. A fatura de {{descricao}}, no valor de {{valor}}, está em aberto desde {{vencimento}}.\n\nPara regularizar é só abrir: {{link}}\n\nSe precisar combinar outra data, é só responder esta mensagem que a gente resolve. {{empresa}}",
  },
];
