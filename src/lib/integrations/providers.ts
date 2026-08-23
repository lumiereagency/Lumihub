import type { IntegrationCategory, IntegrationProviderKey } from "@/generated/prisma/enums";

export interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "checkbox";
  secret: boolean;
  required: boolean;
  placeholder?: string;
}

export interface ProviderDefinition {
  key: IntegrationProviderKey;
  category: IntegrationCategory;
  label: string;
  description: string;
  fields: ProviderField[];
  // Provedores baseados em OAuth (consentimento do usuário no provedor externo)
  // não podem ser verificados só com os campos salvos aqui — a conexão fica
  // sempre PENDENTE até uma fase futura implementar o fluxo de OAuth completo.
  oauthOnly?: boolean;
}

export const PROVIDER_CATALOG: ProviderDefinition[] = [
  {
    key: "GOOGLE_CALENDAR",
    category: "CALENDARIO",
    label: "Google Calendar",
    description: "Sincronização de eventos com o Google Agenda.",
    oauthOnly: true,
    fields: [
      { key: "clientId", label: "Client ID (OAuth)", type: "text", secret: false, required: true },
      { key: "clientSecret", label: "Client Secret (OAuth)", type: "password", secret: true, required: true },
    ],
  },
  {
    key: "OUTLOOK_CALENDAR",
    category: "CALENDARIO",
    label: "Outlook Calendar",
    description: "Sincronização de eventos com o Microsoft Outlook.",
    oauthOnly: true,
    fields: [
      { key: "clientId", label: "Application (client) ID", type: "text", secret: false, required: true },
      { key: "clientSecret", label: "Client secret", type: "password", secret: true, required: true },
    ],
  },
  {
    key: "WHATSAPP_BUSINESS",
    category: "COMUNICACAO",
    label: "WhatsApp Business",
    description: "Envio de lembretes e mensagens via WhatsApp Cloud API.",
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", type: "text", secret: false, required: true },
      { key: "accessToken", label: "Access Token", type: "password", secret: true, required: true },
    ],
  },
  {
    key: "EMAIL_SMTP",
    category: "COMUNICACAO",
    label: "E-mail (SMTP)",
    description: "Envio de e-mails transacionais e lembretes de cobrança via SMTP.",
    fields: [
      { key: "host", label: "Host SMTP", type: "text", secret: false, required: true, placeholder: "smtp.seuservidor.com" },
      { key: "port", label: "Porta", type: "text", secret: false, required: true, placeholder: "587" },
      { key: "user", label: "Usuário", type: "text", secret: false, required: true },
      { key: "fromAddress", label: "E-mail remetente", type: "text", secret: false, required: true },
      { key: "pass", label: "Senha", type: "password", secret: true, required: true },
    ],
  },
  {
    key: "RESEND",
    category: "COMUNICACAO",
    label: "Resend",
    description: "Envio de e-mails transacionais via Resend.",
    fields: [
      { key: "fromAddress", label: "E-mail remetente", type: "text", secret: false, required: true },
      { key: "apiKey", label: "API Key", type: "password", secret: true, required: true },
    ],
  },
  {
    key: "PIX",
    category: "FINANCEIRO",
    label: "Pix",
    description: "Chave Pix para exibição em cobranças e lembretes.",
    fields: [{ key: "pixKey", label: "Chave Pix", type: "password", secret: true, required: true }],
  },
  {
    key: "ASAAS",
    category: "FINANCEIRO",
    label: "Asaas",
    description: "Emissão de cobranças e boletos via Asaas.",
    fields: [{ key: "apiKey", label: "API Key", type: "password", secret: true, required: true }],
  },
  {
    key: "STRIPE",
    category: "FINANCEIRO",
    label: "Stripe",
    description: "Processamento de pagamentos via Stripe.",
    fields: [{ key: "secretKey", label: "Secret Key", type: "password", secret: true, required: true }],
  },
  {
    key: "MERCADO_PAGO",
    category: "FINANCEIRO",
    label: "Mercado Pago",
    description: "Processamento de pagamentos via Mercado Pago.",
    fields: [{ key: "accessToken", label: "Access Token", type: "password", secret: true, required: true }],
  },
  {
    key: "OPENAI",
    category: "IA",
    label: "OpenAI",
    description: "Modelo de linguagem para a Lumi AI.",
    fields: [{ key: "apiKey", label: "API Key", type: "password", secret: true, required: true }],
  },
  {
    key: "ANTHROPIC",
    category: "IA",
    label: "Anthropic (Claude)",
    description: "Modelo de linguagem para a Lumi AI.",
    fields: [{ key: "apiKey", label: "API Key", type: "password", secret: true, required: true }],
  },
  {
    key: "GOOGLE_GEMINI",
    category: "IA",
    label: "Google Gemini",
    description: "Modelo de linguagem para a Lumi AI.",
    fields: [{ key: "apiKey", label: "API Key", type: "password", secret: true, required: true }],
  },
  {
    key: "GOOGLE_DRIVE",
    category: "ARMAZENAMENTO",
    label: "Google Drive",
    description: "Armazenamento de documentos e contratos.",
    oauthOnly: true,
    fields: [
      { key: "clientId", label: "Client ID (OAuth)", type: "text", secret: false, required: true },
      { key: "clientSecret", label: "Client Secret (OAuth)", type: "password", secret: true, required: true },
    ],
  },
  {
    key: "DROPBOX",
    category: "ARMAZENAMENTO",
    label: "Dropbox",
    description: "Armazenamento de documentos e contratos.",
    fields: [{ key: "accessToken", label: "Access Token", type: "password", secret: true, required: true }],
  },
  {
    key: "N8N",
    category: "AUTOMACAO",
    label: "n8n",
    description: "Automação de fluxos via webhook do n8n.",
    fields: [
      { key: "webhookUrl", label: "URL do Webhook", type: "text", secret: false, required: true },
      { key: "secret", label: "Segredo (opcional)", type: "password", secret: true, required: false },
    ],
  },
  {
    key: "MAKE",
    category: "AUTOMACAO",
    label: "Make (Integromat)",
    description: "Automação de fluxos via webhook do Make.",
    fields: [
      { key: "webhookUrl", label: "URL do Webhook", type: "text", secret: false, required: true },
      { key: "secret", label: "Segredo (opcional)", type: "password", secret: true, required: false },
    ],
  },
  {
    key: "ZAPIER",
    category: "AUTOMACAO",
    label: "Zapier",
    description: "Automação de fluxos via webhook do Zapier.",
    fields: [
      { key: "webhookUrl", label: "URL do Webhook", type: "text", secret: false, required: true },
      { key: "secret", label: "Segredo (opcional)", type: "password", secret: true, required: false },
    ],
  },
  {
    key: "WEBHOOK_CUSTOM",
    category: "AUTOMACAO",
    label: "Webhook customizado",
    description: "Envio de eventos do LUMIBASE para um endpoint próprio.",
    fields: [
      { key: "url", label: "URL de destino", type: "text", secret: false, required: true },
      { key: "secret", label: "Segredo (opcional)", type: "password", secret: true, required: false },
    ],
  },
  {
    key: "CUSTOM_API",
    category: "OUTROS",
    label: "API customizada",
    description: "Integração com uma API externa própria.",
    fields: [
      { key: "baseUrl", label: "URL base", type: "text", secret: false, required: true },
      { key: "apiKey", label: "API Key (opcional)", type: "password", secret: false, required: false },
    ],
  },
];

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  CALENDARIO: "Calendário",
  COMUNICACAO: "Comunicação",
  FINANCEIRO: "Financeiro",
  IA: "Inteligência Artificial",
  ARMAZENAMENTO: "Armazenamento",
  AUTOMACAO: "Automação",
  OUTROS: "Outros",
};

export function getProviderDefinition(key: IntegrationProviderKey): ProviderDefinition | undefined {
  return PROVIDER_CATALOG.find((p) => p.key === key);
}
