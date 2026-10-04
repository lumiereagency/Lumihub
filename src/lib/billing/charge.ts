import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { formatDueDate } from "@/lib/billing/dates";
import { getPricingSettings } from "@/lib/pricing/settings";
import { decryptSecret } from "@/lib/integrations/vault";
import { buildPixCode, cityFrom } from "@/lib/billing/pix";
import { renderMessageBody, type ChargeMessageValues } from "@/lib/validation/billing";

// Tudo o que uma mensagem de cobrança precisa: link de pagamento, chave Pix
// e Pix copia e cola com o valor exato. Usado pela régua, pelo "Enviar
// cobrança agora" e pela página pública /pagar/<token>.

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function ensurePublicToken(receivableId: string): Promise<string> {
  const current = await db.accountReceivable.findUnique({ where: { id: receivableId }, select: { publicToken: true } });
  if (current?.publicToken) return current.publicToken;
  const token = randomBytes(18).toString("base64url");
  await db.accountReceivable.updateMany({ where: { id: receivableId, publicToken: null }, data: { publicToken: token } });
  const saved = await db.accountReceivable.findUniqueOrThrow({ where: { id: receivableId }, select: { publicToken: true } });
  return saved.publicToken!;
}

// Chave Pix: a das configurações de Orçamentos; se não houver, a da integração Pix.
export async function getPixSetup(organizationId: string) {
  const settings = await getPricingSettings(organizationId);
  let key = settings.pixKey;
  if (!key) {
    const integration = await db.integration.findUnique({
      where: { organizationId_provider: { organizationId, provider: "PIX" } },
      include: { credentials: true },
    });
    const c = integration?.status === "CONECTADO" ? integration.credentials.find((x) => x.label === "pixKey") : undefined;
    key = c ? decryptSecret({ encryptedValue: c.encryptedValue, iv: c.iv, authTag: c.authTag }) : null;
  }
  return {
    key,
    name: settings.company.legalName,
    city: cityFrom(settings.company.city) || cityFrom(settings.company.address) || "Goiania",
    thanks: settings.billingThanks,
    pixSeparate: settings.billingPixSeparate,
  };
}

export interface ChargeContext extends ChargeMessageValues {
  receivableId: string;
  organizationId: string;
  phone: string | null;
  email: string | null;
  amount: number;
  status: string;
  pixSeparate: boolean;
}

export async function buildChargeContext(receivableId: string): Promise<ChargeContext> {
  const r = await db.accountReceivable.findUniqueOrThrow({
    where: { id: receivableId },
    include: { client: true, organization: { select: { currency: true } } },
  });
  const [token, pix] = await Promise.all([ensurePublicToken(r.id), getPixSetup(r.organizationId)]);
  const amount = Number(r.amount);
  return {
    receivableId: r.id,
    organizationId: r.organizationId,
    phone: r.client.phone,
    email: r.client.email,
    amount,
    status: r.status,
    pixSeparate: pix.pixSeparate,
    clientName: (r.client.contactName || r.client.companyName).split(" ")[0],
    valueLabel: formatCurrency(amount, r.organization.currency),
    dueDateLabel: formatDueDate(r.dueDate),
    description: r.description,
    company: pix.name,
    pixKey: pix.key,
    pixCode: pix.key ? buildPixCode({ key: pix.key, name: pix.name, city: pix.city, amount, txid: r.id }) : null,
    link: `${appUrl()}/pagar/${token}`,
  };
}

export function renderCharge(template: string, ctx: ChargeContext): string {
  return renderMessageBody(template, ctx);
}

// Mensagem padrão quando não há modelo para a situação (ex: "Enviar cobrança agora").
export function defaultChargeMessage(daysFromDue: number): string {
  if (daysFromDue < 0)
    return "Oi, {{nome}}! Tudo bem? 😊\nPassando para lembrar que a fatura de {{descricao}}, no valor de {{valor}}, vence em {{vencimento}}.\n\nPara pagar é só abrir: {{link}}\n\nQualquer dúvida, estamos por aqui.";
  if (daysFromDue === 0)
    return "Oi, {{nome}}! A fatura de {{descricao}}, no valor de {{valor}}, vence hoje ({{vencimento}}).\n\nPara pagar é só abrir: {{link}}\n\nSe já pagou, pode desconsiderar. Obrigado!";
  return "Oi, {{nome}}, tudo bem? Ainda não identificamos o pagamento da fatura de {{descricao}}, no valor de {{valor}}, que venceu em {{vencimento}}.\n\nPara pagar é só abrir: {{link}}\n\nSe já pagou, pode enviar o comprovante pelo mesmo link. Se precisar combinar outra data, é só responder esta mensagem.";
}
