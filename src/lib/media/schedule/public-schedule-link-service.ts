import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";

function generateToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function getPublicScheduleLink(organizationId: string) {
  return db.mediaPublicScheduleLink.findUnique({ where: { organizationId } });
}

// Cria o link na primeira vez que alguém visita Configurações — não expõe
// nenhum botão de "criar", só existe, sempre, um link por organização.
export async function ensurePublicScheduleLink(organizationId: string) {
  const existing = await getPublicScheduleLink(organizationId);
  if (existing) return existing;
  return db.mediaPublicScheduleLink.create({ data: { organizationId, token: generateToken() } });
}

// Sobrescreve o token — o link anterior vira inválido imediatamente,
// sem exigir revogação separada nem deixar linhas antigas no banco.
export async function rotatePublicScheduleLink(organizationId: string) {
  return db.mediaPublicScheduleLink.upsert({
    where: { organizationId },
    create: { organizationId, token: generateToken() },
    update: { token: generateToken(), rotatedAt: new Date() },
  });
}

export async function resolveOrganizationByPublicToken(token: string) {
  const link = await db.mediaPublicScheduleLink.findUnique({ where: { token }, include: { organization: true } });
  return link?.organization ?? null;
}
