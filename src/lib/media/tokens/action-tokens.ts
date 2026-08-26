import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { confirmAttendance, declineAttendance } from "@/lib/media/schedule/attendance-service";
import { requestSwap, cancelSwap, respondToSwapAsTarget } from "@/lib/media/schedule/swap-service";
import { findEligibleMembers } from "@/lib/media/schedule/conflict-service";
import { rankEligibleMembers } from "@/lib/media/ai/candidate-ranking";
import { notifyMediaLeaders } from "@/lib/media/schedule/notification-service";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { formatDate, formatDateTime } from "@/lib/format";

const AVAILABILITY_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SWAP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createToken(data: {
  organizationId: string;
  memberId: string;
  type: "AVAILABILITY_REQUEST" | "SCHEDULE_CONFIRMATION" | "SWAP_ACCEPT";
  eventId?: string;
  scheduleId?: string;
  swapRequestId?: string;
  expiresAt: Date;
}): Promise<string> {
  const token = crypto.randomBytes(24).toString("hex");
  await db.mediaActionToken.create({ data: { ...data, tokenHash: hashToken(token) } });
  return token;
}

// ---------------------------------------------------------------------
// Criação (chamada pelas ações que disparam WhatsApp)
// ---------------------------------------------------------------------

// Pergunta de disponibilidade pontual, antes de existir escala (§ fluxo
// original — culto específico, sem membro ainda escalado nele).
export async function createAvailabilityRequestToken(organizationId: string, memberId: string, eventId: string): Promise<string> {
  return createToken({ organizationId, memberId, type: "AVAILABILITY_REQUEST", eventId, expiresAt: new Date(Date.now() + AVAILABILITY_TOKEN_TTL_MS) });
}

// Disparo único por escala publicada — expira só depois do fim do período
// (+ folga), nunca no primeiro clique: a mesma página lista todos os dias
// do membro naquele mês e cada um é respondido de forma independente.
export async function createScheduleConfirmationToken(organizationId: string, memberId: string, scheduleId: string, periodEnd: Date): Promise<string> {
  const expiresAt = new Date(periodEnd.getTime() + 10 * 24 * 60 * 60 * 1000);
  return createToken({ organizationId, memberId, type: "SCHEDULE_CONFIRMATION", scheduleId, expiresAt });
}

async function createSwapAcceptToken(organizationId: string, memberId: string, swapRequestId: string): Promise<string> {
  return createToken({ organizationId, memberId, type: "SWAP_ACCEPT", swapRequestId, expiresAt: new Date(Date.now() + SWAP_TOKEN_TTL_MS) });
}

function swapAcceptMessage(candidateName: string, previousMemberName: string, functionName: string, eventName: string, eventStartAt: Date, token: string): string {
  return `Oi, ${candidateName}! ${previousMemberName} não poderá servir como ${functionName} no culto ${eventName} (${formatDate(eventStartAt)}). Você topa cobrir essa vaga? Responda aqui: ${appUrl()}/midia/acao/${token}`;
}

// ---------------------------------------------------------------------
// Resolução (chamada pela página pública /midia/acao/[token])
// ---------------------------------------------------------------------

export type ResolvedActionToken =
  | { kind: "not_found" }
  | { kind: "expired" }
  | {
      kind: "availability";
      organizationId: string;
      status: "valid" | "used";
      memberName: string;
      eventName: string;
      eventStartAt: Date;
      eventLocation: string | null;
    }
  | {
      kind: "schedule";
      organizationId: string;
      memberName: string;
      scheduleName: string;
      assignments: {
        assignmentId: string;
        eventName: string;
        eventStartAt: Date;
        eventLocation: string | null;
        functionName: string;
        confirmationStatus: string;
      }[];
    }
  | {
      kind: "swap";
      organizationId: string;
      status: "valid" | "used";
      memberName: string;
      previousMemberName: string;
      functionName: string;
      eventName: string;
      eventStartAt: Date;
      eventLocation: string | null;
    };

export async function resolveActionToken(token: string): Promise<ResolvedActionToken> {
  const row = await db.mediaActionToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      member: { include: { user: { select: { name: true } } } },
      event: true,
      schedule: true,
      swapRequest: { include: { assignment: { include: { event: true, function: true } }, requestedBy: { include: { user: { select: { name: true } } } } } },
    },
  });
  if (!row) return { kind: "not_found" };
  if (row.expiresAt < new Date()) return { kind: "expired" };

  if (row.type === "AVAILABILITY_REQUEST" && row.event) {
    return {
      kind: "availability",
      organizationId: row.organizationId,
      status: row.usedAt ? "used" : "valid",
      memberName: row.member.user.name,
      eventName: row.event.name,
      eventStartAt: row.event.startAt,
      eventLocation: row.event.location,
    };
  }

  if (row.type === "SCHEDULE_CONFIRMATION" && row.schedule) {
    const assignments = await db.mediaScheduleAssignment.findMany({
      where: { scheduleId: row.scheduleId!, memberId: row.memberId },
      include: { event: true, function: true, attendance: true },
      orderBy: { event: { startAt: "asc" } },
    });
    return {
      kind: "schedule",
      organizationId: row.organizationId,
      memberName: row.member.user.name,
      scheduleName: row.schedule.name,
      assignments: assignments.map((a) => ({
        assignmentId: a.id,
        eventName: a.event.name,
        eventStartAt: a.event.startAt,
        eventLocation: a.event.location,
        functionName: a.function.name,
        confirmationStatus: a.attendance?.confirmationStatus ?? "PENDING",
      })),
    };
  }

  if (row.type === "SWAP_ACCEPT" && row.swapRequest) {
    return {
      kind: "swap",
      organizationId: row.organizationId,
      status: row.usedAt ? "used" : "valid",
      memberName: row.member.user.name,
      previousMemberName: row.swapRequest.requestedBy.user.name,
      functionName: row.swapRequest.assignment.function.name,
      eventName: row.swapRequest.assignment.event.name,
      eventStartAt: row.swapRequest.assignment.event.startAt,
      eventLocation: row.swapRequest.assignment.event.location,
    };
  }

  return { kind: "not_found" };
}

// ---------------------------------------------------------------------
// Respostas (chamadas pelas server actions da página pública)
// ---------------------------------------------------------------------

interface ServiceResult {
  error?: string;
  success?: string;
}

// Fluxo original: disponibilidade pontual -> MediaAvailabilityException.
function toUTCHHMM(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export async function respondAvailabilityToken(token: string, available: boolean): Promise<ServiceResult> {
  const row = await db.mediaActionToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { event: true } });
  if (!row || row.type !== "AVAILABILITY_REQUEST" || !row.event) return { error: "Link inválido." };
  if (row.usedAt) return { error: "Esta resposta já foi registrada anteriormente." };
  if (row.expiresAt < new Date()) return { error: "Este link expirou." };

  const dateOnly = new Date(Date.UTC(row.event.startAt.getFullYear(), row.event.startAt.getMonth(), row.event.startAt.getDate()));
  const endAt = row.event.endAt ?? new Date(row.event.startAt.getTime() + 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    await tx.mediaAvailabilityException.create({
      data: {
        memberId: row.memberId,
        date: dateOnly,
        startTime: toUTCHHMM(row.event!.startAt),
        endTime: toUTCHHMM(endAt),
        available,
        reason: "Respondido via link do WhatsApp",
      },
    });
    await tx.mediaActionToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  });

  await audit({
    organizationId: row.organizationId,
    action: available ? "MEDIA_AVAILABILITY_TOKEN_YES" : "MEDIA_AVAILABILITY_TOKEN_NO",
    entityType: "MediaEvent",
    entityId: row.eventId!,
    metadata: { memberId: row.memberId },
  });

  return {
    success: available ? "Obrigado! Registramos que você está disponível para este culto." : "Obrigado! Registramos que você não está disponível para este culto.",
  };
}

// Confirmação mensal: responde UM dia da lista, sem consumir o token —
// o membro pode voltar e responder os outros dias quando quiser.
export async function respondAssignmentViaToken(token: string, assignmentId: string, available: boolean): Promise<ServiceResult> {
  const row = await db.mediaActionToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.type !== "SCHEDULE_CONFIRMATION" || !row.scheduleId) return { error: "Link inválido." };
  if (row.expiresAt < new Date()) return { error: "Este link expirou." };

  // Nunca confia no assignmentId puro do cliente: só aceita se a
  // atribuição realmente pertence a este membro NESTA escala do token.
  const assignment = await db.mediaScheduleAssignment.findFirst({
    where: { id: assignmentId, scheduleId: row.scheduleId, memberId: row.memberId },
  });
  if (!assignment) return { error: "Atribuição não encontrada para você nesta escala." };

  const member = await db.mediaMember.findUniqueOrThrow({ where: { id: row.memberId }, select: { userId: true } });

  if (available) {
    // Reconfirmar depois de ter recusado cancela a troca automática
    // pendente, se ainda não foi decidida — evita duas coisas acontecendo
    // ao mesmo tempo para a mesma vaga.
    const activeSwap = await db.mediaSwapRequest.findFirst({
      where: { assignmentId, requestedByMemberId: row.memberId, status: { in: ["PENDING_TARGET", "TARGET_ACCEPTED", "PENDING_LEADER"] } },
    });
    if (activeSwap) await cancelSwap(row.organizationId, member.userId, activeSwap.id, row.memberId);

    const result = await confirmAttendance(row.organizationId, member.userId, assignmentId, row.memberId);
    return result.error ? result : { success: "Presença confirmada." };
  }

  await declineAttendance(row.organizationId, member.userId, assignmentId, row.memberId);
  return suggestSubstituteForAssignment(row.organizationId, assignmentId, row.memberId);
}

// Recusa dispara a busca automática de substituto (§ pedido do usuário) —
// mesmo motor de pontuação da geração por IA, e a troca segue o MESMO
// fluxo de aprovação de sempre (aceite do substituto + aprovação da
// liderança). A IA só poupa o trabalho de descobrir quem perguntar.
async function suggestSubstituteForAssignment(organizationId: string, assignmentId: string, decliningMemberId: string): Promise<ServiceResult> {
  const assignment = await db.mediaScheduleAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { event: true, function: true, schedule: true, member: { include: { user: { select: { name: true } } } } },
  });

  const candidates = await findEligibleMembers(
    organizationId,
    assignment.functionId,
    assignment.event.startAt,
    assignment.event.endAt,
    assignment.eventId,
    decliningMemberId,
  );
  const ranked = await rankEligibleMembers(
    organizationId,
    candidates,
    assignment.functionId,
    assignment.schedule.periodStart,
    assignment.schedule.periodEnd,
    assignment.event.startAt,
  );
  const best = ranked.find((c) => c.aiScore !== null) ?? null;

  if (!best) {
    await notifyMediaLeaders(
      organizationId,
      "Vaga sem substituto automático",
      `${assignment.member?.user.name ?? "Um membro"} não poderá servir como ${assignment.function.name} em ${assignment.event.name} (${formatDate(assignment.event.startAt)}) e a IA não encontrou ninguém disponível — revise manualmente.`,
      `/midia-adesf/escalas/${assignment.scheduleId}`,
    );
    return { success: "Indisponibilidade registrada. Nenhum substituto disponível foi encontrado automaticamente — a liderança foi avisada." };
  }

  const swapResult = await requestSwap(
    organizationId,
    assignment.member!.userId,
    assignmentId,
    decliningMemberId,
    best.memberId,
    "Sugerido automaticamente pela IA — o membro original não está disponível.",
  );
  if (swapResult.error) {
    // Já existe uma troca em andamento para esta vaga — não é uma falha
    // real, só não há nada novo a fazer.
    return { success: "Indisponibilidade registrada." };
  }

  const swap = await db.mediaSwapRequest.findFirst({
    where: { assignmentId, targetMemberId: best.memberId, status: "PENDING_TARGET" },
    orderBy: { createdAt: "desc" },
  });
  if (swap) {
    const targetMember = await db.mediaMember.findUnique({ where: { id: best.memberId } });
    const previousName = assignment.member?.user.name ?? "Um colega";

    if (!targetMember?.phone) {
      await notifyMediaLeaders(
        organizationId,
        "Substituto sugerido sem telefone",
        `${best.name} foi sugerido(a) automaticamente para cobrir ${assignment.function.name} em ${assignment.event.name}, mas não tem telefone cadastrado — avise manualmente e peça para responder em Solicitações.`,
        `/midia-adesf/solicitacoes`,
      );
    } else {
      const swapToken = await createSwapAcceptToken(organizationId, best.memberId, swap.id);
      const message = swapAcceptMessage(best.name, previousName, assignment.function.name, assignment.event.name, assignment.event.startAt, swapToken);
      const sendResult = await sendWhatsApp({ organizationId, to: targetMember.phone, message });
      // sendWhatsApp nunca lança erro quando falha (WhatsApp desconectado,
      // número inválido) — só devolve delivered:false. Sem checar isso
      // aqui, a troca fica presa em PENDING_TARGET pra sempre, sem
      // ninguém nunca saber que o convite nunca chegou ao substituto
      // (§ pedido do usuário: "consta alteração pendente" sem andamento).
      if (!sendResult.delivered) {
        await notifyMediaLeaders(
          organizationId,
          "Substituto sugerido, mas não notificado",
          `${best.name} foi sugerido(a) automaticamente para cobrir ${assignment.function.name} em ${assignment.event.name}, mas o convite por WhatsApp não pôde ser enviado (${sendResult.error ?? (sendResult.pending ? "WhatsApp desconectado" : "erro desconhecido")}). Reenvie manualmente em Solicitações assim que o WhatsApp estiver reconectado.`,
          `/midia-adesf/solicitacoes`,
        );
      }
    }
  }

  return { success: `Indisponibilidade registrada. ${best.name} foi convidado(a) automaticamente para cobrir a vaga.` };
}

// Reenvio manual (§ pedido do usuário: troca ficou "pendente" sem avançar
// porque o WhatsApp estava desconectado quando o convite automático foi
// disparado) — mesma mensagem/token de sempre, só que sob demanda em vez
// de só no momento da recusa original.
export async function resendSwapAcceptNotification(organizationId: string, swapRequestId: string): Promise<ServiceResult> {
  const swap = await db.mediaSwapRequest.findFirst({
    where: { id: swapRequestId, organizationId, status: "PENDING_TARGET" },
    include: {
      targetMember: { include: { user: { select: { name: true } } } },
      assignment: { include: { event: true, function: true } },
      requestedBy: { include: { user: { select: { name: true } } } },
    },
  });
  if (!swap) return { error: "Solicitação não encontrada ou já respondida." };
  if (!swap.targetMember.phone) return { error: "Este membro não tem telefone cadastrado." };

  const swapToken = await createSwapAcceptToken(organizationId, swap.targetMemberId, swap.id);
  const message = swapAcceptMessage(
    swap.targetMember.user.name,
    swap.requestedBy.user.name,
    swap.assignment.function.name,
    swap.assignment.event.name,
    swap.assignment.event.startAt,
    swapToken,
  );
  const sendResult = await sendWhatsApp({ organizationId, to: swap.targetMember.phone, message });
  if (!sendResult.delivered) {
    return { error: sendResult.error ?? "WhatsApp não está conectado no momento — verifique em Configurações → Integrações." };
  }
  return { success: "Convite de troca reenviado por WhatsApp." };
}

// Substituto sugerido aceita/recusa pelo link — reaproveita 100% do
// mesmo respondToSwapAsTarget do fluxo manual (Fase 02); só a origem da
// chamada é sem sessão. Uso único.
export async function respondSwapViaToken(token: string, accept: boolean): Promise<ServiceResult> {
  const row = await db.mediaActionToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.type !== "SWAP_ACCEPT" || !row.swapRequestId) return { error: "Link inválido." };
  if (row.usedAt) return { error: "Esta resposta já foi registrada anteriormente." };
  if (row.expiresAt < new Date()) return { error: "Este link expirou." };

  const member = await db.mediaMember.findUniqueOrThrow({ where: { id: row.memberId }, select: { userId: true } });
  const result = await respondToSwapAsTarget(row.organizationId, member.userId, row.swapRequestId, row.memberId, accept);
  if (result.error) return result;

  await db.mediaActionToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return result;
}

// ---------------------------------------------------------------------
// Disparo em massa ao publicar a escala do mês
// ---------------------------------------------------------------------

export interface ScheduleConfirmationDispatchResult {
  sent: number;
  withoutPhone: number;
  failed: number;
}

// Um disparo por membro por escala publicada (§ pedido do usuário: "não
// ficar mandando toda hora") — lista todos os cultos do membro naquele
// mês num link só, em vez de um link por culto.
export async function sendScheduleConfirmationRequests(scheduleId: string, organizationId: string): Promise<ScheduleConfirmationDispatchResult> {
  const schedule = await db.mediaSchedule.findUniqueOrThrow({ where: { id: scheduleId } });

  const assignments = await db.mediaScheduleAssignment.findMany({
    where: { scheduleId, memberId: { not: null } },
    include: { event: true, function: true, member: { include: { user: { select: { name: true } } } } },
    orderBy: { event: { startAt: "asc" } },
  });

  const byMember = new Map<string, { name: string; phone: string | null; lines: string[] }>();
  for (const a of assignments) {
    const entry = byMember.get(a.memberId!) ?? { name: a.member!.user.name, phone: a.member!.phone, lines: [] };
    entry.lines.push(`• ${formatDateTime(a.event.startAt)} · ${a.function.name}`);
    byMember.set(a.memberId!, entry);
  }

  let sent = 0;
  let withoutPhone = 0;
  let failed = 0;
  for (const [memberId, entry] of byMember) {
    if (!entry.phone) {
      withoutPhone++;
      continue;
    }
    const token = await createScheduleConfirmationToken(organizationId, memberId, scheduleId, schedule.periodEnd);
    const message = `Olá, ${entry.name}! A ${schedule.name} foi publicada. Você foi escalado em ${entry.lines.length} culto(s):\n${entry.lines.join("\n")}\n\nConfirme sua disponibilidade em cada dia: ${appUrl()}/midia/acao/${token}`;
    // Conta como enviado só se realmente entregou — sendWhatsApp nunca
    // lança erro quando o WhatsApp está desconectado, só devolve
    // delivered:false, então sem checar isso o retorno mentiria dizendo
    // que todo mundo foi avisado.
    const result = await sendWhatsApp({ organizationId, to: entry.phone, message });
    if (result.delivered) sent++;
    else failed++;
  }

  return { sent, withoutPhone, failed };
}
