import "server-only";
import nodemailer from "nodemailer";
import type { IntegrationProviderKey } from "@/generated/prisma/enums";
import { verifyAutentiqueKey } from "@/lib/integrations/autentique";

export interface VerifyResult {
  ok: boolean;
  message: string;
}

type Verifier = (creds: Record<string, string>) => Promise<VerifyResult>;

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Verificação genérica para automações baseadas em webhook: qualquer resposta
// HTTP do servidor de destino (mesmo 4xx) prova que a URL é alcançável de
// verdade. Só uma falha de rede/DNS/timeout é reportada como erro.
async function pingReachability(url: string): Promise<VerifyResult> {
  try {
    const res = await fetchWithTimeout(url, { method: "GET" });
    return { ok: true, message: `Endpoint alcançável (HTTP ${res.status}).` };
  } catch (err) {
    return { ok: false, message: `Não foi possível alcançar a URL: ${(err as Error).message}` };
  }
}

async function verifySmtp(creds: Record<string, string>): Promise<VerifyResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: Number(creds.port) || 587,
      secure: Number(creds.port) === 465,
      auth: { user: creds.user, pass: creds.pass },
    });
    await transporter.verify();
    return { ok: true, message: "Conexão SMTP verificada com sucesso." };
  } catch (err) {
    return { ok: false, message: `Falha ao conectar no SMTP: ${(err as Error).message}` };
  }
}

async function verifyBearer(url: string, token: string, providerLabel: string): Promise<VerifyResult> {
  try {
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return { ok: true, message: `${providerLabel} validou a credencial com sucesso.` };
    return { ok: false, message: `${providerLabel} recusou a credencial (HTTP ${res.status}).` };
  } catch (err) {
    return { ok: false, message: `Falha ao contatar ${providerLabel}: ${(err as Error).message}` };
  }
}

const VERIFIERS: Partial<Record<IntegrationProviderKey, Verifier>> = {
  EMAIL_SMTP: verifySmtp,
  OPENAI: (creds) => verifyBearer("https://api.openai.com/v1/models", creds.apiKey, "OpenAI"),
  ANTHROPIC: async (creds) => {
    try {
      const res = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": creds.apiKey, "anthropic-version": "2023-06-01" },
      });
      if (res.ok) return { ok: true, message: "Anthropic validou a credencial com sucesso." };
      return { ok: false, message: `Anthropic recusou a credencial (HTTP ${res.status}).` };
    } catch (err) {
      return { ok: false, message: `Falha ao contatar a Anthropic: ${(err as Error).message}` };
    }
  },
  GOOGLE_GEMINI: async (creds) => {
    try {
      const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(creds.apiKey)}`);
      if (res.ok) return { ok: true, message: "Google Gemini validou a credencial com sucesso." };
      return { ok: false, message: `Google Gemini recusou a credencial (HTTP ${res.status}).` };
    } catch (err) {
      return { ok: false, message: `Falha ao contatar o Google Gemini: ${(err as Error).message}` };
    }
  },
  STRIPE: (creds) => verifyBearer("https://api.stripe.com/v1/balance", creds.secretKey, "Stripe"),
  MERCADO_PAGO: (creds) => verifyBearer("https://api.mercadopago.com/users/me", creds.accessToken, "Mercado Pago"),
  ASAAS: async (creds) => {
    try {
      const res = await fetchWithTimeout("https://api.asaas.com/v3/finance/balance", { headers: { access_token: creds.apiKey } });
      if (res.ok) return { ok: true, message: "Asaas validou a credencial com sucesso." };
      return { ok: false, message: `Asaas recusou a credencial (HTTP ${res.status}).` };
    } catch (err) {
      return { ok: false, message: `Falha ao contatar a Asaas: ${(err as Error).message}` };
    }
  },
  RESEND: (creds) => verifyBearer("https://api.resend.com/domains", creds.apiKey, "Resend"),
  DROPBOX: async (creds) => {
    try {
      const res = await fetchWithTimeout("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      if (res.ok) return { ok: true, message: "Dropbox validou a credencial com sucesso." };
      return { ok: false, message: `Dropbox recusou a credencial (HTTP ${res.status}).` };
    } catch (err) {
      return { ok: false, message: `Falha ao contatar o Dropbox: ${(err as Error).message}` };
    }
  },
  YOUTUBE_DATA_API: async (creds) => {
    try {
      const res = await fetchWithTimeout(
        `https://www.googleapis.com/youtube/v3/search?part=id&type=channel&maxResults=1&q=teste&key=${encodeURIComponent(creds.apiKey)}`,
      );
      if (res.ok) return { ok: true, message: "YouTube Data API validou a credencial com sucesso." };
      const body = await res.json().catch(() => null);
      const reason = body?.error?.message ? ` (${body.error.message})` : "";
      return { ok: false, message: `YouTube recusou a credencial (HTTP ${res.status})${reason}.` };
    } catch (err) {
      return { ok: false, message: `Falha ao contatar a YouTube Data API: ${(err as Error).message}` };
    }
  },
  AUTENTIQUE: (creds) => verifyAutentiqueKey(creds.apiKey),
  META_SOCIAL: async (creds) => {
    try {
      const res = await fetchWithTimeout(`https://graph.facebook.com/oauth/access_token?${new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: "client_credentials" })}`);
      if (res.ok) return { ok: true, message: "A Meta validou o ID e a chave do app. Agora conecte as contas em cada cliente → Redes." };
      const body = await res.json().catch(() => null);
      return { ok: false, message: `A Meta recusou o app (HTTP ${res.status})${body?.error?.message ? `: ${body.error.message}` : "."}` };
    } catch (err) {
      return { ok: false, message: `Falha ao contatar a Meta: ${(err as Error).message}` };
    }
  },
  TIKTOK_SOCIAL: async (creds) => {
    try {
      const res = await fetchWithTimeout("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_key: creds.clientId, client_secret: creds.clientSecret, grant_type: "client_credentials" }).toString(),
      });
      const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
      if (res.ok && body.access_token) return { ok: true, message: "O TikTok validou a chave do app. Agora conecte as contas em cada cliente → Redes." };
      return { ok: false, message: `O TikTok recusou o app${body.error_description ? `: ${body.error_description}` : ` (HTTP ${res.status})`}.` };
    } catch (err) {
      return { ok: false, message: `Falha ao contatar o TikTok: ${(err as Error).message}` };
    }
  },
  N8N: (creds) => pingReachability(creds.webhookUrl),
  MAKE: (creds) => pingReachability(creds.webhookUrl),
  ZAPIER: (creds) => pingReachability(creds.webhookUrl),
  WEBHOOK_CUSTOM: (creds) => pingReachability(creds.url),
  CUSTOM_API: (creds) => pingReachability(creds.baseUrl),
};

export function hasVerifier(provider: IntegrationProviderKey): boolean {
  return provider in VERIFIERS;
}

export async function verifyIntegration(provider: IntegrationProviderKey, creds: Record<string, string>): Promise<VerifyResult | null> {
  const verifier = VERIFIERS[provider];
  if (!verifier) return null;
  return verifier(creds);
}
