import "server-only";
import crypto from "node:crypto";

// Endereço temporário e assinado para a rede buscar um arquivo do post
// (o Instagram e o Facebook pedem o vídeo por URL). Vale por algumas horas.
function secret(): string {
  const v = process.env.SESSION_SECRET;
  if (!v) throw new Error("SESSION_SECRET não configurado.");
  return v;
}

function sign(targetId: string, idx: number, exp: number): string {
  return crypto.createHmac("sha256", secret()).update(`${targetId}.${idx}.${exp}`).digest("base64url");
}

export function signedMediaUrl(targetId: string, idx: number, ttlMs = 6 * 3600_000): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const exp = Date.now() + ttlMs;
  return `${base.replace(/\/$/, "")}/api/social/media/${targetId}/${idx}?exp=${exp}&sig=${sign(targetId, idx, exp)}`;
}

export function verifyMediaSignature(targetId: string, idx: number, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = Buffer.from(sign(targetId, idx, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function publicImageUrl(batchToken: string, postId: string, idx: number): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/aprovacao/${batchToken}/${postId}/${idx}`;
}
