import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integrations/vault";

// Autentique (assinatura eletrônica) — API v2, só GraphQL.
// Docs: https://docs.autentique.com.br/api — createDocument é enviado como
// multipart/form-data (spec graphql-multipart-request) com o PDF do contrato.

const API_URL = "https://api.autentique.com.br/v2/graphql";
const TIMEOUT_MS = 30000;

export interface AutentiqueCredentials {
  integrationId: string;
  apiKey: string;
  webhookSecret: string | null;
  sandbox: boolean;
}

export interface AutentiqueSigner {
  publicId: string;
  name: string | null;
  email: string | null;
  link: string | null;
  signedAt: string | null;
  rejectedAt: string | null;
  viewedAt?: string | null;
}

export interface AutentiqueDocument {
  id: string;
  name: string;
  signers: AutentiqueSigner[];
  signedFileUrl: string | null;
}

export async function getAutentiqueCredentials(organizationId: string): Promise<AutentiqueCredentials | null> {
  const integration = await db.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "AUTENTIQUE" } },
    include: { credentials: true },
  });
  if (!integration || integration.status !== "CONECTADO") return null;
  const read = (label: string) => {
    const c = integration.credentials.find((x) => x.label === label);
    return c ? decryptSecret({ encryptedValue: c.encryptedValue, iv: c.iv, authTag: c.authTag }) : null;
  };
  const apiKey = read("apiKey");
  if (!apiKey) return null;
  const config = (integration.config ?? {}) as Record<string, unknown>;
  return { integrationId: integration.id, apiKey, webhookSecret: read("webhookSecret"), sandbox: config.sandbox === "on" || config.sandbox === true };
}

async function post(apiKey: string, body: BodyInit, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, ...headers }, body, signal: controller.signal });
    const json = (await res.json().catch(() => null)) as { data?: Record<string, unknown>; errors?: { message?: string }[]; message?: string } | null;
    if (!res.ok || !json || json.errors?.length) {
      const message = json?.errors?.map((e) => e.message).filter(Boolean).join("; ") || json?.message || `HTTP ${res.status}`;
      throw new Error(`Autentique: ${message}`);
    }
    return json.data ?? {};
  } finally {
    clearTimeout(timeout);
  }
}

export async function autentiqueQuery(apiKey: string, query: string, variables: Record<string, unknown> = {}) {
  return post(apiKey, JSON.stringify({ query, variables }), { "Content-Type": "application/json" });
}

export async function verifyAutentiqueKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const data = await autentiqueQuery(apiKey, "query { me { name email } }");
    const me = data.me as { name?: string; email?: string } | undefined;
    return { ok: true, message: `Autentique conectado${me?.email ? ` como ${me.email}` : ""}.` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

const SIGNATURE_FIELDS = "public_id name email link { short_link } signed { created_at } rejected { created_at } viewed { created_at }";

interface RawSignature {
  public_id: string;
  name?: string | null;
  email?: string | null;
  link?: { short_link?: string | null } | null;
  signed?: { created_at?: string } | null;
  rejected?: { created_at?: string } | null;
  viewed?: { created_at?: string } | null;
}

function mapSigners(raw: RawSignature[] | undefined): AutentiqueSigner[] {
  return (raw ?? []).map((s) => ({
    publicId: s.public_id,
    name: s.name ?? null,
    email: s.email ?? null,
    link: s.link?.short_link ?? null,
    signedAt: s.signed?.created_at ?? null,
    rejectedAt: s.rejected?.created_at ?? null,
    viewedAt: s.viewed?.created_at ?? null,
  }));
}

export async function createAutentiqueDocument(input: {
  credentials: AutentiqueCredentials;
  name: string;
  message?: string;
  pdf: Buffer;
  fileName: string;
  signers: ({ name: string } | { email: string })[];
}): Promise<AutentiqueDocument> {
  const query = `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
    createDocument(${input.credentials.sandbox ? "sandbox: true, " : ""}document: $document, signers: $signers, file: $file) {
      id name signatures { ${SIGNATURE_FIELDS} }
    }
  }`;
  const variables = {
    document: { name: input.name, ...(input.message ? { message: input.message } : {}), refusable: true },
    signers: input.signers.map((s) => ({ ...s, action: "SIGN" })),
    file: null,
  };
  const form = new FormData();
  form.append("operations", JSON.stringify({ query, variables }));
  form.append("map", JSON.stringify({ file: ["variables.file"] }));
  form.append("file", new Blob([new Uint8Array(input.pdf)], { type: "application/pdf" }), input.fileName);

  const data = await post(input.credentials.apiKey, form);
  const doc = data.createDocument as { id: string; name: string; signatures?: RawSignature[] } | undefined;
  if (!doc?.id) throw new Error("Autentique não devolveu o documento criado.");

  const signers = mapSigners(doc.signatures);
  // Signatário cadastrado só pelo nome recebe o link aqui; se vier vazio, gera.
  for (const s of signers) {
    if (!s.link && !s.email) {
      const res = await autentiqueQuery(input.credentials.apiKey, `mutation { createLinkToSignature(public_id: "${s.publicId}") { short_link } }`).catch(() => null);
      s.link = (res?.createLinkToSignature as { short_link?: string } | undefined)?.short_link ?? null;
    }
  }
  return { id: doc.id, name: doc.name, signers, signedFileUrl: null };
}

export async function getAutentiqueDocument(credentials: AutentiqueCredentials, documentId: string): Promise<AutentiqueDocument | null> {
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(documentId)) return null;
  const data = await autentiqueQuery(credentials.apiKey, `query { document(id: "${documentId}") { id name files { signed } signatures { ${SIGNATURE_FIELDS} } } }`);
  const doc = data.document as { id: string; name: string; files?: { signed?: string | null }; signatures?: RawSignature[] } | null;
  if (!doc) return null;
  return { id: doc.id, name: doc.name, signers: mapSigners(doc.signatures), signedFileUrl: doc.files?.signed ?? null };
}

export function verifyAutentiqueSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(header.trim(), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
