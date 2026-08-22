import { z } from "zod";

export const MESSAGE_TRIGGERS = ["D_MENOS_7", "D_MENOS_3", "D_MENOS_1", "D_0", "D_MAIS_1", "D_MAIS_5"] as const;

export const MESSAGE_TRIGGER_LABELS: Record<(typeof MESSAGE_TRIGGERS)[number], string> = {
  D_MENOS_7: "D-7",
  D_MENOS_3: "D-3",
  D_MENOS_1: "D-1",
  D_0: "D0 (vencimento)",
  D_MAIS_1: "D+1",
  D_MAIS_5: "D+5",
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
  { key: "{{nome}}", description: "Nome do cliente" },
  { key: "{{valor}}", description: "Valor da cobrança (formatado)" },
  { key: "{{vencimento}}", description: "Data de vencimento" },
  { key: "{{pix}}", description: "Chave Pix da organização (se configurada)" },
];

export function renderMessageBody(
  template: string,
  values: { clientName: string; valueLabel: string; dueDateLabel: string; pixKey: string | null },
): string {
  return template
    .replaceAll("{{nome}}", values.clientName)
    .replaceAll("{{valor}}", values.valueLabel)
    .replaceAll("{{vencimento}}", values.dueDateLabel)
    .replaceAll("{{pix}}", values.pixKey ?? "chave Pix não configurada");
}
