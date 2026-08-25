import { z } from "zod";

export const CONTRACT_TYPES = [
  "CLIENTE",
  "FUNCIONARIO",
  "FREELANCER",
  "PRESTADOR",
  "UGC",
  "AUDIOVISUAL",
  "SOCIAL_MEDIA",
  "TRAFEGO",
  "DESIGN",
  "DESENVOLVIMENTO",
  "PERSONALIZADO",
] as const;

export const CONTRACT_TYPE_LABELS: Record<(typeof CONTRACT_TYPES)[number], string> = {
  CLIENTE: "Cliente",
  FUNCIONARIO: "Funcionário",
  FREELANCER: "Freelancer",
  PRESTADOR: "Prestador",
  UGC: "UGC",
  AUDIOVISUAL: "Audiovisual",
  SOCIAL_MEDIA: "Social Media",
  TRAFEGO: "Tráfego",
  DESIGN: "Design",
  DESENVOLVIMENTO: "Desenvolvimento",
  PERSONALIZADO: "Projeto personalizado",
};

export const CONTRACT_STATUSES = [
  "RASCUNHO",
  "AGUARDANDO_ASSINATURA",
  "ATIVO",
  "ENCERRADO",
  "CANCELADO",
] as const;

export const CONTRACT_STATUS_LABELS: Record<(typeof CONTRACT_STATUSES)[number], string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_ASSINATURA: "Aguardando assinatura",
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
};

export const RECURRENCE_TYPES = ["UNICO", "MENSAL", "TRIMESTRAL", "ANUAL"] as const;

export const RECURRENCE_LABELS: Record<(typeof RECURRENCE_TYPES)[number], string> = {
  UNICO: "Pagamento único",
  MENSAL: "Mensal",
  TRIMESTRAL: "Trimestral",
  ANUAL: "Anual",
};

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const contractSchema = z.object({
  clientId: z.string().min(1, "Selecione um cliente."),
  templateId: z.preprocess(emptyToUndefined, z.string().optional()),
  title: z.string().trim().min(1, "Informe o título do contrato."),
  type: z.enum(CONTRACT_TYPES).default("CLIENTE"),
  value: z.coerce.number().positive("Informe um valor maior que zero."),
  recurrence: z.enum(RECURRENCE_TYPES).default("UNICO"),
  startDate: z.coerce.date({ error: "Informe a data de início." }),
  endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  // Independente de início/término (que só contam a duração do contrato):
  // é o que ancora a geração das cobranças recorrentes. Sem isso, a
  // primeira cobrança usa o início do contrato como referência.
  paymentDay: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(31).optional()),
  status: z.enum(CONTRACT_STATUSES).default("RASCUNHO"),
});

export type ContractInput = z.infer<typeof contractSchema>;

export const contractTemplateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do modelo."),
  type: z.enum(CONTRACT_TYPES).default("CLIENTE"),
  bodyTemplate: z.string().trim().min(1, "Informe o texto do modelo."),
});

export type ContractTemplateInput = z.infer<typeof contractTemplateSchema>;

export const TEMPLATE_PLACEHOLDERS: { key: string; description: string }[] = [
  { key: "{{cliente}}", description: "Nome da empresa do cliente" },
  { key: "{{cnpj}}", description: "CNPJ do cliente" },
  { key: "{{contato}}", description: "Nome do responsável pelo cliente" },
  { key: "{{titulo}}", description: "Título do contrato" },
  { key: "{{valor}}", description: "Valor do contrato (formatado em moeda)" },
  { key: "{{recorrencia}}", description: "Recorrência (única, mensal, trimestral, anual)" },
  { key: "{{data_inicio}}", description: "Data de início" },
  { key: "{{data_fim}}", description: "Data de término (ou 'indeterminado')" },
  { key: "{{contratada}}", description: "Nome da sua empresa (organização)" },
];

export function renderContractBody(
  template: string,
  values: {
    clientName: string;
    clientCnpj: string | null;
    clientContact: string | null;
    title: string;
    valueLabel: string;
    recurrenceLabel: string;
    startDateLabel: string;
    endDateLabel: string;
    organizationName: string;
  },
): string {
  return template
    .replaceAll("{{cliente}}", values.clientName)
    .replaceAll("{{cnpj}}", values.clientCnpj ?? "não informado")
    .replaceAll("{{contato}}", values.clientContact ?? "não informado")
    .replaceAll("{{titulo}}", values.title)
    .replaceAll("{{valor}}", values.valueLabel)
    .replaceAll("{{recorrencia}}", values.recurrenceLabel)
    .replaceAll("{{data_inicio}}", values.startDateLabel)
    .replaceAll("{{data_fim}}", values.endDateLabel)
    .replaceAll("{{contratada}}", values.organizationName);
}
