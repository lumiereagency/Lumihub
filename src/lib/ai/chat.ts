import "server-only";
import type { IntegrationProviderKey } from "@/generated/prisma/enums";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Modelos padrão por provedor. Ajustável conforme os provedores evoluem seus
// catálogos — não há lógica de negócio acoplada ao nome exato do modelo.
const MODELS: Record<string, string> = {
  ANTHROPIC: "claude-haiku-4-5-20251001",
  OPENAI: "gpt-4o-mini",
  GOOGLE_GEMINI: "gemini-1.5-flash",
};

const TIMEOUT_MS = 30000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(apiKey: string, systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELS.ANTHROPIC,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic respondeu HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.content?.find((block: { type: string }) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic não retornou texto na resposta.");
  return text;
}

async function callOpenAi(apiKey: string, systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELS.OPENAI,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI respondeu HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI não retornou texto na resposta.");
  return text;
}

async function callGemini(apiKey: string, systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1/models/${MODELS.GOOGLE_GEMINI}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      }),
    },
  );
  if (!res.ok) throw new Error(`Google Gemini respondeu HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Google Gemini não retornou texto na resposta.");
  return text;
}

// Chamada real ao provedor conectado — sem fallback simulado. Uma falha aqui
// deve sempre virar um erro honesto para quem chamou, nunca uma resposta
// inventada.
export async function callAiProvider(
  provider: IntegrationProviderKey,
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<string> {
  switch (provider) {
    case "ANTHROPIC":
      return callAnthropic(apiKey, systemPrompt, messages);
    case "OPENAI":
      return callOpenAi(apiKey, systemPrompt, messages);
    case "GOOGLE_GEMINI":
      return callGemini(apiKey, systemPrompt, messages);
    default:
      throw new Error(`Provedor de IA "${provider}" não suportado pela Lumi AI.`);
  }
}
