import "server-only";
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

// LUMIHUB VAULT: toda credencial de integração é criptografada com AES-256-GCM
// antes de tocar o banco. A chave mestra nunca é gravada — vem só do
// VAULT_MASTER_KEY do ambiente, derivada para 32 bytes via SHA-256 (aceita
// qualquer tamanho de segredo configurado, ex: saída de `openssl rand -base64 32`).
function getMasterKey(): Buffer {
  const raw = process.env.VAULT_MASTER_KEY;
  if (!raw) throw new Error("VAULT_MASTER_KEY não configurada no ambiente.");
  return crypto.createHash("sha256").update(raw).digest();
}

// Uint8Array (não Buffer) para casar exatamente com o tipo que o Prisma
// gera para colunas Bytes — evita o mismatch estrutural entre os genéricos
// ArrayBufferLike (Buffer) e ArrayBuffer (Uint8Array) do TypeScript.
export interface EncryptedSecret {
  encryptedValue: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  authTag: Uint8Array<ArrayBuffer>;
}

// Copia para um Uint8Array apoiado num ArrayBuffer "puro" (não
// ArrayBufferLike) — é o único jeito de satisfazer o tipo Uint8Array<ArrayBuffer>
// que o Prisma gera para colunas Bytes a partir de um Buffer do Node.
function toPlainUint8Array(buf: Buffer): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(new ArrayBuffer(buf.length));
  arr.set(buf);
  return arr;
}

export function encryptSecret(plainText: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
  const encryptedValue = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedValue: toPlainUint8Array(encryptedValue),
    iv: toPlainUint8Array(iv),
    authTag: toPlainUint8Array(authTag),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), Buffer.from(secret.iv));
  decipher.setAuthTag(Buffer.from(secret.authTag));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(secret.encryptedValue)), decipher.final()]);
  return decrypted.toString("utf8");
}

export function maskSecret(plainText: string): string {
  if (plainText.length <= 4) return "••••";
  return `••••${plainText.slice(-4)}`;
}
