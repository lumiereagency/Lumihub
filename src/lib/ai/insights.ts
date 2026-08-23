import "server-only";
import { z } from "zod";
import { getFinanceOverview } from "@/lib/finance/queries";
import { buildSystemContext } from "@/lib/ai/context";
import { callAiProvider } from "@/lib/ai/chat";
import { getConnectedAiProvider } from "@/lib/ai/providers";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth/session";
import { ALERT_SEVERITIES } from "@/lib/validation/alerts";

const insightItemSchema = z.object({
  type: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(600),
  severity: z.enum(ALERT_SEVERITIES),
});

const insightsResponseSchema = z.array(insightItemSchema).max(8);

export type GeneratedInsight = z.infer<typeof insightItemSchema>;

const INSTRUCTIONS = `
Além do contexto acima, aqui está a tendência de receita e despesa dos últimos 6 meses (dados reais, pagos):
{TREND}

Baseado exclusivamente nos dados reais fornecidos, gere de 2 a 6 insights (riscos, oportunidades ou recomendações) úteis para a gestão da agência.
Responda SOMENTE com um array JSON válido, sem nenhum texto antes ou depois, exatamente neste formato:
[{"type": "slug_curto", "title": "Título direto", "description": "Explicação de 1 a 3 frases, sempre referenciando um número ou fato real do contexto", "severity": "URGENTE"}]
"severity" deve ser exatamente um de: URGENTE, ATENCAO, INFORMATIVO, OPORTUNIDADE.
Se não houver dados suficientes para uma análise significativa, responda com um array vazio: [].
Nunca invente números, nomes ou fatos que não estejam no contexto fornecido.
`.trim();

export async function generateInsights(user: CurrentUser, organizationName: string): Promise<GeneratedInsight[]> {
  const provider = await getConnectedAiProvider(user.organizationId);
  if (!provider) {
    throw new Error("Nenhum provedor de IA conectado. Conecte OpenAI, Anthropic ou Google Gemini em Configurações → Integrações.");
  }

  const [systemContext, overview] = await Promise.all([
    buildSystemContext(user, organizationName),
    getFinanceOverview(user.organizationId),
  ]);

  const organization = await db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { currency: true } });
  const trend = overview.charts.receitaDespesaMensal
    .map((m) => `${m.label}: receita ${formatCurrency(m.receita, organization.currency)}, despesa ${formatCurrency(m.despesa, organization.currency)}`)
    .join("; ");

  const systemPrompt = `${systemContext}\n\n${INSTRUCTIONS.replace("{TREND}", trend || "sem histórico suficiente")}`;

  const raw = await callAiProvider(provider.provider, provider.apiKey, systemPrompt, [
    { role: "user", content: "Gere os insights agora, seguindo exatamente o formato pedido." },
  ]);

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("A IA não retornou um array JSON válido. Tente novamente.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("A IA retornou um JSON inválido. Tente novamente.");
  }

  const result = insightsResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("A IA retornou insights em um formato inesperado. Tente novamente.");
  }

  return result.data;
}
