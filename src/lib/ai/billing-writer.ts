import "server-only";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { getConnectedAiProvider } from "@/lib/ai/providers";
import { callAiProvider } from "@/lib/ai/chat";
import { buildChargeContext } from "@/lib/billing/charge";
import { buildGroupContext, openChargesFor } from "@/lib/billing/group";
import { brasiliaDay, dueDay, formatDueDate } from "@/lib/billing/dates";
import { MESSAGE_TRIGGER_LABELS, TEMPLATE_PLACEHOLDERS } from "@/lib/validation/billing";

// Lumi AI escrevendo cobranças. A IA só sugere o texto: ele aparece na tela
// para a equipe revisar e editar antes de salvar ou enviar. A régua
// automática continua usando os modelos salvos, sem depender da IA.

export const AI_TONES = {
  amigavel: "amigável e acolhedor, como quem lembra um cliente querido",
  direto: "direto e objetivo, cordial, sem rodeios",
  firme: "firme e educado, deixando claro que o pagamento está pendente, sem ser agressivo",
} as const;

const RULES = `
Você escreve mensagens de cobrança para WhatsApp em português do Brasil, em nome de uma agência.
Regras obrigatórias:
- Mensagem curta (até ~600 caracteres), em parágrafos curtos, pronta para colar no WhatsApp.
- No máximo 1 ou 2 emojis, e só se combinarem com o tom.
- Nunca ameace (nada de protesto, SPC/Serasa, advogado, corte de serviço) e nunca invente multa, juros, desconto ou prazo.
- Nunca invente valores, datas ou nomes: use somente os dados fornecidos.
- O código Pix NÃO entra no texto (ele vai numa mensagem separada).
- Ofereça ajuda: se já pagou, pode enviar o comprovante pelo link; se precisar combinar outra data, é só responder.
- Responda SOMENTE com o texto da mensagem, sem aspas, sem título e sem explicações.
`.trim();

async function ask(organizationId: string, system: string, prompt: string): Promise<string> {
  const provider = await getConnectedAiProvider(organizationId);
  if (!provider) throw new Error("Nenhuma IA conectada. Conecte OpenAI, Anthropic (Claude) ou Google Gemini em Configurações → Integrações.");
  let raw: string;
  try {
    raw = await callAiProvider(provider.provider, provider.apiKey, system, [{ role: "user", content: prompt }]);
  } catch (e) {
    console.error("[ia-cobranca]", (e as Error).message);
    throw new Error("A IA não respondeu agora. Tente de novo em instantes.");
  }
  return clean(raw);
}

function clean(raw: string): string {
  return raw
    .replace(/^```[a-z]*\n?|```$/gim, "")
    .replace(/^\s*["“]|["”]\s*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2500);
}

function toneOf(tone: string): string {
  return AI_TONES[tone as keyof typeof AI_TONES] ?? AI_TONES.amigavel;
}

// Modelo da régua: texto com os campos {{...}} que a base preenche na hora.
export async function writeTemplateWithAi(
  organizationId: string,
  input: { trigger: string; tone: string; instructions: string; current: string },
): Promise<string> {
  const when = MESSAGE_TRIGGER_LABELS[input.trigger as keyof typeof MESSAGE_TRIGGER_LABELS] ?? "no dia do vencimento";
  const allowed = TEMPLATE_PLACEHOLDERS.filter((p) => p.key !== "{{pix_copia_cola}}");
  const system = `${RULES}
- Este texto é um MODELO: em vez de dados reais, use exatamente estes campos, que a base troca pelos valores na hora de enviar:
${allowed.map((p) => `  ${p.key} = ${p.description}`).join("\n")}
- Use {{link}} exatamente uma vez. Use {{nome}}, {{descricao}} e {{valor}}. Não crie outros campos entre chaves.`;
  const prompt = [
    `Escreva o modelo de mensagem enviado ${when.toLowerCase()}.`,
    `Tom: ${toneOf(input.tone)}.`,
    input.instructions && `Pedido da equipe: ${input.instructions}`,
    input.current && `Texto atual (melhore a partir dele):\n${input.current}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let body = await ask(organizationId, system, prompt);
  // Campo inventado vira texto comum; o link nunca pode faltar.
  const keys = new Set(allowed.map((p) => p.key));
  body = body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => (keys.has(`{{${String(k).toLowerCase()}}}`) ? `{{${String(k).toLowerCase()}}}` : ""));
  body = body.replace(/[ \t]{2,}/g, " ");
  if (!body.includes("{{link}}")) body += "\n\nPara pagar é só abrir: {{link}}";
  return body;
}

// Cobrança pronta para um cliente, com os dados reais e o histórico dele.
export async function writeChargeWithAi(
  organizationId: string,
  receivableId: string,
  input: { tone: string; instructions: string; current: string },
): Promise<string> {
  const r = await db.accountReceivable.findUniqueOrThrow({
    where: { id: receivableId },
    select: { clientId: true, organization: { select: { currency: true } } },
  });
  const currency = r.organization.currency;
  const { items } = await openChargesFor(receivableId);
  const ctx = items.length > 1 ? await buildGroupContext(receivableId, items) : await buildChargeContext(receivableId);
  const today = brasiliaDay(new Date());

  const [paid, lastSent] = await Promise.all([
    db.accountReceivable.findMany({ where: { clientId: r.clientId, status: "PAGO" }, select: { dueDate: true, paidAt: true }, orderBy: { paidAt: "desc" }, take: 12 }),
    db.paymentReminder.findMany({
      where: { receivable: { clientId: r.clientId }, status: { in: ["ENVIADO", "MANUAL"] }, sentAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
      select: { sentAt: true },
      orderBy: { sentAt: "desc" },
    }),
  ]);
  const paidLate = paid.filter((p) => p.paidAt && dueDay(p.paidAt) > dueDay(p.dueDate)).length;

  const lines = items.map((i) => {
    const d = dueDay(i.dueDate);
    const when = d < today ? `venceu em ${formatDueDate(i.dueDate)}` : d === today ? "vence hoje" : `vence em ${formatDueDate(i.dueDate)}`;
    return `- ${i.description}: ${formatCurrency(i.amount, currency)} (${when})`;
  });

  const facts = [
    `Cliente: ${ctx.clientName}`,
    `Empresa que recebe: ${ctx.company}`,
    items.length > 1 ? `Faturas em aberto (cite todas):\n${lines.join("\n")}\nTotal: ${ctx.valueLabel}` : `Fatura:\n${lines[0] ?? `- ${ctx.description}: ${ctx.valueLabel} (vence em ${ctx.dueDateLabel})`}`,
    `Link de pagamento (use exatamente este, uma vez): ${ctx.link}`,
    `Histórico: ${paid.length} fatura(s) paga(s) recentemente${paid.length ? `, ${paidLate} com atraso` : ""}; ${lastSent.length} cobrança(s) enviada(s) nos últimos 30 dias.`,
  ].join("\n");

  const system = `${RULES}
- Se o cliente costuma pagar em dia, seja leve; se já recebeu várias cobranças, seja mais objetivo, sempre educado.`;
  const prompt = [
    `Escreva a mensagem de cobrança com estes dados:\n${facts}`,
    `Tom: ${toneOf(input.tone)}.`,
    input.instructions && `Pedido da equipe: ${input.instructions}`,
    input.current && `Rascunho atual (melhore a partir dele, mantendo os dados):\n${input.current}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Mensagem real não pode sair com campo {{...}} sem preencher.
  let body = (await ask(organizationId, system, prompt)).replace(/\{\{[^}]*\}\}/g, "").replace(/[ \t]{2,}/g, " ");
  if (!body.includes(ctx.link)) body += `\n\nPara pagar é só abrir: ${ctx.link}`;
  return body;
}
