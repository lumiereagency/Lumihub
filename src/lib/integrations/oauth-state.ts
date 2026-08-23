import "server-only";
import crypto from "node:crypto";

// Estado assinado (HMAC-SHA256 com SESSION_SECRET) trafegado como cookie
// httpOnly de curta duração entre /start e /callback do fluxo OAuth. Nunca
// confiamos em `state`/`code_verifier` vindos só da query string do provedor
// externo — precisam bater com o que assinamos aqui, ou o callback rejeita a
// tentativa como possível CSRF.
export interface OAuthStatePayload {
  provider: string;
  organizationId: string;
  userId: string;
  codeVerifier: string;
  nonce: string;
  exp: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET não configurado.");
  return value;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createOAuthState(payload: Omit<OAuthStatePayload, "exp" | "nonce">): string {
  const full: OAuthStatePayload = {
    ...payload,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  const signature = sign(data);
  return `${data}.${signature}`;
}

export function verifyOAuthState(token: string): OAuthStatePayload | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = sign(data);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as OAuthStatePayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function codeChallengeFromVerifier(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
