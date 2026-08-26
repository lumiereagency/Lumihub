import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Link de um clique por WhatsApp perguntando disponibilidade para um culto
// específico (sem exigir login — o token é a própria autorização, mesmo
// modelo do link de redefinir senha). Guarda só o hash; o token puro só
// existe na URL enviada ao membro.
export async function createAvailabilityRequestToken(organizationId: string, memberId: string, eventId: string): Promise<string> {
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await db.mediaActionToken.create({
    data: { organizationId, memberId, eventId, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return token;
}

export interface ResolvedActionToken {
  status: "valid" | "used" | "expired" | "not_found";
  organizationId?: string;
  memberName?: string;
  eventName?: string;
  eventStartAt?: Date;
  eventLocation?: string | null;
}

export async function resolveActionToken(token: string): Promise<ResolvedActionToken> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = await db.mediaActionToken.findUnique({
    where: { tokenHash },
    include: { member: { include: { user: { select: { name: true } } } }, event: true },
  });
  if (!row) return { status: "not_found" };

  const base = {
    organizationId: row.organizationId,
    memberName: row.member.user.name,
    eventName: row.event.name,
    eventStartAt: row.event.startAt,
    eventLocation: row.event.location,
  };
  if (row.usedAt) return { status: "used", ...base };
  if (row.expiresAt < new Date()) return { status: "expired", ...base };
  return { status: "valid", ...base };
}

// Converte para "HH:mm" em UTC — mesma convenção que getMemberAvailabilityState
// (@/lib/media/schedule/conflict-service) já usa para comparar exceções: a
// data-base é sempre meia-noite UTC e os horários são lidos como minutos
// UTC do dia, nunca ajustados pelo fuso do processo Node.
function toUTCHHMM(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

// Registra a resposta de disponibilidade como uma MediaAvailabilityException
// pontual para a data do culto — a mesma tabela que a IA e o preenchimento
// manual já consultam, então a resposta do WhatsApp vale imediatamente sem
// nenhum código novo de leitura.
export async function respondAvailabilityToken(token: string, available: boolean): Promise<{ error?: string; success?: string }> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = await db.mediaActionToken.findUnique({ where: { tokenHash }, include: { event: true } });
  if (!row) return { error: "Link inválido." };
  if (row.usedAt) return { error: "Esta resposta já foi registrada anteriormente." };
  if (row.expiresAt < new Date()) return { error: "Este link expirou." };

  const dateOnly = new Date(Date.UTC(row.event.startAt.getFullYear(), row.event.startAt.getMonth(), row.event.startAt.getDate()));
  const endAt = row.event.endAt ?? new Date(row.event.startAt.getTime() + 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    await tx.mediaAvailabilityException.create({
      data: {
        memberId: row.memberId,
        date: dateOnly,
        startTime: toUTCHHMM(row.event.startAt),
        endTime: toUTCHHMM(endAt),
        available,
        reason: "Respondido via link do WhatsApp",
      },
    });
    await tx.mediaActionToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  });

  // Sem sessão (link público, sem login) — userId fica null no audit,
  // mesma convenção de eventos sem ator autenticado já usada em @/lib/audit.
  await audit({
    organizationId: row.organizationId,
    action: available ? "MEDIA_AVAILABILITY_TOKEN_YES" : "MEDIA_AVAILABILITY_TOKEN_NO",
    entityType: "MediaEvent",
    entityId: row.eventId,
    metadata: { memberId: row.memberId },
  });

  return {
    success: available ? "Obrigado! Registramos que você está disponível para este culto." : "Obrigado! Registramos que você não está disponível para este culto.",
  };
}
