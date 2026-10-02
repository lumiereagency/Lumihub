import "server-only";
import { db } from "@/lib/db";
import { normalizeConfig, type FeeRow, type PricingConfig } from "@/lib/pricing/engine";

export const DEFAULT_WHATSAPP_TEMPLATE =
  "Oi, {nome}! Tudo bem? Aqui é {vendedor}, da Lumière. ✨\n\n" +
  "Preparei o seu orçamento personalizado de *{titulo}*. Pelo link você vê tudo o que está incluso, as formas de pagamento e já pode responder por lá mesmo:\n\n" +
  "{link}\n\n" +
  "O orçamento vale até {validade}. Qualquer dúvida, é só me chamar aqui!";

export const DEFAULT_CONTRACT_MESSAGE =
  "Oi, {nome}! Que bom ter você com a gente. 🤝\n\n" +
  "Seu contrato de *{titulo}* já está pronto para assinatura digital (Autentique, com validade jurídica). Leva menos de 2 minutos:\n\n" +
  "{link}\n\n" +
  "Assim que assinar, eu já te aviso dos próximos passos.";

export interface PricingSettingsView {
  config: PricingConfig;
  validityDays: number;
  pixKey: string | null;
  whatsappTemplate: string;
  contractMessage: string;
  company: {
    legalName: string;
    document: string | null;
    address: string | null;
    city: string | null;
    representativeName: string | null;
    representativeEmail: string | null;
    representativeDoc: string | null;
  };
}

export async function getPricingSettings(organizationId: string): Promise<PricingSettingsView> {
  const row = await db.pricingSettings.findUnique({ where: { organizationId } });
  const config = normalizeConfig(
    row
      ? {
          debitFee: Number(row.debitFee),
          rows: row.installmentFees as unknown as FeeRow[],
          creditMargin: Number(row.creditMargin),
          maxInstallments: row.maxInstallments,
        }
      : null,
  );
  return {
    config,
    validityDays: row?.validityDays ?? 7,
    pixKey: row?.pixKey ?? null,
    whatsappTemplate: row?.whatsappTemplate || DEFAULT_WHATSAPP_TEMPLATE,
    contractMessage: row?.contractTemplateMsg || DEFAULT_CONTRACT_MESSAGE,
    company: {
      legalName: row?.companyLegalName || "AGÊNCIA LUMIERE LTDA",
      document: row?.companyDocument ?? null,
      address: row?.companyAddress ?? null,
      city: row?.companyCity ?? null,
      representativeName: row?.representativeName ?? null,
      representativeEmail: row?.representativeEmail ?? null,
      representativeDoc: row?.representativeDoc ?? null,
    },
  };
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? vars[key] : m));
}
