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
  const result = await findAndInviteNextCandidate(row.organizationId, assignmentId, row.memberId, []);
  return result.error ? result : { success: `Indisponibilidade registrada. ${result.success}` };
}

// Convida UM candidato específico e cuida do envio por WhatsApp — usada
// tanto pela cascata automática (findAndInviteNextCandidate) quanto pela
// reatribuição manual do admin (manuallyReassignSwapTarget), já que as
// duas fazem exatamente a mesma coisa, só escolhendo o candidato de jeitos
// diferentes (IA rankeada vs. escolha manual).
async function inviteCandidateForSwap(
  organizationId: string,
  assignmentId: string,
  requestedByUserId: string,
  decliningMemberId: string,
  candidateMemberId: string,
  candidateName: string,
  previousMemberName: string,
  functionName: string,
  eventName: string,
  eventStartAt: Date,
): Promise<ServiceResult & { delivered?: boolean }> {
  const swapResult = await requestSwap(
    organizationId,
    requestedByUserId,
    assignmentId,
    decliningMemberId,
    candidateMemberId,
    "Sugerido automaticamente pela IA — o membro original não está disponível.",
    true,
  );
  if (swapResult.error) return swapResult;

  const swap = await db.mediaSwapRequest.findFirst({
    where: { assignmentId, targetMemberId: candidateMemberId, status: "PENDING_TARGET" },
    orderBy: { createdAt: "desc" },
  });
  if (!swap) return { success: `${candidateName} foi convidado(a) para cobrir a vaga.` };

  const targetMember = await db.mediaMember.findUnique({ where: { id: candidateMemberId } });
  if (!targetMember?.phone) {
    await notifyMediaLeaders(
      organizationId,
      "Substituto sugerido sem telefone",
      `${candidateName} foi sugerido(a) automaticamente para cobrir ${functionName} em ${eventName}, mas não tem telefone cadastrado — avise manualmente e peça para responder em Solicitações.`,
      `/midia-adesf/solicitacoes`,
    );
    return { success: `${candidateName} foi convidado(a), mas não tem telefone cadastrado.`, delivered: false };
  }

  const swapToken = await createSwapAcceptToken(organizationId, candidateMemberId, swap.id);
  const message = swapAcceptMessage(candidateName, previousMemberName, functionName, eventName, eventStartAt, swapToken);
  // sendWhatsApp nunca lança erro quando falha (WhatsApp desconectado,
  // número inválido) — só devolve delivered:false. Sem checar isso, a
  // troca fica presa em PENDING_TARGET pra sempre, sem ninguém nunca
  // saber que o convite nunca chegou ao substituto (§ pedido do usuário:
  // "consta alteração pendente" sem andamento).
  const sendResult = await sendWhatsApp({ organizationId, to: targetMember.phone, message });
  if (!sendResult.delivered) {
    return { success: `${candidateName} foi convidado(a), mas o WhatsApp não entregou o convite.`, delivered: false };
  }
  return { success: `${candidateName} foi convidado(a) automaticamente para cobrir a vaga.`, delivered: true };
}

// Recusa (ou timeout de resposta) dispara a busca automática de
// substituto (§ pedido do usuário: "fazer o disparo automático para esses
// membros... até que algum deles aceite") — mesmo motor de pontuação da
// geração por IA, e a troca segue o MESMO fluxo de aprovação de sempre
// (aceite do substituto + aprovação da liderança). Quando a entrega por
// WhatsApp falha (não quando a pessoa só ainda não respondeu), tenta o
// próximo candidato na hora — não faz sentido esperar resposta de uma
// mensagem que nunca chegou a sair.
async function findAndInviteNextCandidate(
  organizationId: string,
  assignmentId: string,
  decliningMemberId: string,
  excludeMemberIds: string[],
): Promise<ServiceResult> {
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
  const eligible = candidates.filter((c) => !excludeMemberIds.includes(c.memberId));
  const ranked = await rankEligibleMembers(
    organizationId,
    eligible,
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
      excludeMemberIds.length > 0
        ? `${assignment.member?.user.name ?? "Um membro"} não poderá servir como ${assignment.function.name} em ${assignment.event.name} (${formatDate(assignment.event.startAt)}). ${excludeMemberIds.length} pessoa(s) já foram convidadas automaticamente e ninguém respondeu a tempo — revise manualmente.`
        : `${assignment.member?.user.name ?? "Um membro"} não poderá servir como ${assignment.function.name} em ${assignment.event.name} (${formatDate(assignment.event.startAt)}) e a IA não encontrou ninguém disponível — revise manualmente.`,
      `/midia-adesf/escalas/${assignment.scheduleId}`,
    );
    return { success: "Nenhum substituto disponível foi encontrado automaticamente — a liderança foi avisada." };
  }

  const invite = await inviteCandidateForSwap(
    organizationId,
    assignmentId,
    assignment.member!.userId,
    decliningMemberId,
    best.memberId,
    best.name,
    assignment.member?.user.name ?? "Um colega",
    assignment.function.name,
    assignment.event.name,
    assignment.event.startAt,
  );
  if (invite.error) return invite;
  if (invite.delivered === false) {
    return findAndInviteNextCandidate(organizationId, assignmentId, decliningMemberId, [...excludeMemberIds, best.memberId]);
  }
  return invite;
}

const SWAP_ESCALATION_TIMEOUT_MS = 60 * 60 * 1000; // 1h — decisão do usuário

// Chamada periodicamente por um cron externo (não há infraestrutura de
// cron dentro do processo Next.js self-hosted — mesmo padrão de
// /api/cron/generate-receivables) para avançar trocas sugeridas pela IA
// que ninguém respondeu dentro do prazo, passando para o próximo
// candidato automaticamente.
export async function escalateStaleAutoSuggestedSwaps(): Promise<{ escalated: number }> {
  const cutoff = new Date(Date.now() - SWAP_ESCALATION_TIMEOUT_MS);
  const stale = await db.mediaSwapRequest.findMany({
    where: { status: "PENDING_TARGET", autoSuggested: true, requestedAt: { lt: cutoff } },
  });

  let escalated = 0;
  for (const swap of stale) {
    await db.mediaSwapRequest.update({
      where: { id: swap.id },
      data: { status: "EXPIRED", targetRespondedAt: new Date(), decisionNotes: "Sem resposta dentro do prazo — escalado automaticamente para o próximo candidato." },
    });

    const priorAttempts = await db.mediaSwapRequest.findMany({
      where: { assignmentId: swap.assignmentId, requestedByMemberId: swap.requestedByMemberId },
      select: { targetMemberId: true },
    });
    await findAndInviteNextCandidate(swap.organizationId, swap.assignmentId, swap.requestedByMemberId, priorAttempts.map((p) => p.targetMemberId));
    escalated++;
  }
  return { escalated };
}

// Candidatos ainda não tentados para esta vaga (§ pedido do usuário: opção
// do admin escolher outra pessoa manualmente em vez de esperar a cascata
// automática) — mesma lista/ranking da IA, só exclui quem já foi
// convidado para esta MESMA vaga.
export async function getSwapReassignCandidates(organizationId: string, swapId: string) {
  const swap = await db.mediaSwapRequest.findFirst({
    where: { id: swapId, organizationId },
    include: { assignment: { include: { event: true, schedule: true } } },
  });
  if (!swap) return [];

  const priorAttempts = await db.mediaSwapRequest.findMany({
    where: { assignmentId: swap.assignmentId, requestedByMemberId: swap.requestedByMemberId },
    select: { targetMemberId: true },
  });
  const excludeIds = new Set(priorAttempts.map((p) => p.targetMemberId));

  const candidates = await findEligibleMembers(
    organizationId,
    swap.assignment.functionId,
    swap.assignment.event.startAt,
    swap.assignment.event.endAt,
    swap.assignment.eventId,
    swap.requestedByMemberId,
  );
  const eligible = candidates.filter((c) => !excludeIds.has(c.memberId));
  return rankEligibleMembers(organizationId, eligible, swap.assignment.functionId, swap.assignment.schedule.periodStart, swap.assignment.schedule.periodEnd, swap.assignment.event.startAt);
}

// Admin escolhe manualmente outro membro pra convidar em vez do atual
// (§ pedido do usuário: "deixe a opção para que o adm escolha fazer o
// disparo para outro de dentro da plataforma") — expira o convite pendente
// atual e convida o novo, reaproveitando a mesma lógica de envio da
// cascata automática.
export async function manuallyReassignSwapTarget(organizationId: string, swapId: string, newTargetMemberId: string): Promise<ServiceResult> {
  const swap = await db.mediaSwapRequest.findFirst({
    where: { id: swapId, organizationId, status: "PENDING_TARGET" },
    include: { assignment: { include: { event: true, function: true, member: { include: { user: { select: { name: true } } } } } } },
  });
  if (!swap) return { error: "Solicitação não encontrada ou já respondida." };
  if (newTargetMemberId === swap.targetMemberId) return { error: "Selecione um membro diferente do atual." };

  const newTarget = await db.mediaMember.findFirst({
    where: { id: newTargetMemberId, organizationId, status: "ACTIVE" },
    include: { user: { select: { name: true } } },
  });
  if (!newTarget) return { error: "Membro não encontrado ou inativo." };
  const hasFunction = await db.mediaMemberFunction.findFirst({ where: { memberId: newTargetMemberId, functionId: swap.assignment.functionId } });
  if (!hasFunction) return { error: "Este membro não está habilitado para esta função." };

  await db.mediaSwapRequest.update({
    where: { id: swap.id },
    data: { status: "EXPIRED", targetRespondedAt: new Date(), decisionNotes: "Substituído manualmente pela liderança por outro convite." },
  });

  return inviteCandidateForSwap(
    organizationId,
    swap.assignmentId,
    swap.assignment.member!.userId,
    swap.requestedByMemberId,
    newTargetMemberId,
    newTarget.user.name,
    swap.assignment.member?.user.name ?? "Um colega",
    swap.assignment.function.name,
    swap.assignment.event.name,
    swap.assignment.event.startAt,
  );
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
  // Mostra o número exato usado (§ pedido do usuário: "diz que foi mas não
  // chegou") — o jeito mais rápido de descartar (ou confirmar) um número
  // cadastrado errado é comparar esse dígito a dígito com o WhatsApp real
  // do membro, já que o WhatsApp confirmou que ESSE número existe — só não
  // necessariamente é o do membro certo.
  return { success: `Convite de troca reenviado por WhatsApp para +${sendResult.to}. Confira se esse é o número correto de ${swap.targetMember.user.name}.` };
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

// Aviso automático quando a liderança escala/substitui alguém manualmente
// numa vaga de uma escala já publicada (§ pedido do usuário: "como ela vai
// saber?") — antes só existia uma notificação dentro do portal (o
// sininho), que só aparece se a pessoa entrar e conferir; agora sai
// também por WhatsApp, com o mesmo link de confirmação por dia que a
// escala mensal já usa (ela também vê ali os outros dias em que já estava
// escalada nesta mesma escala, não só este).
export async function notifyMemberOfManualAssignment(organizationId: string, assignmentId: string): Promise<void> {
  const assignment = await db.mediaScheduleAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { event: true, function: true, schedule: true, member: { include: { user: { select: { name: true } } } } },
  });
  if (!assignment.memberId || !assignment.member?.phone) return;

  const token = await createScheduleConfirmationToken(organizationId, assignment.memberId, assignment.scheduleId, assignment.schedule.periodEnd);
  const message = `Olá, ${assignment.member.user.name}! Você foi escalado(a) como ${assignment.function.name} em ${assignment.event.name} (${formatDate(assignment.event.startAt)}). Confirme se poderá estar: ${appUrl()}/midia/acao/${token}`;
  await sendWhatsApp({ organizationId, to: assignment.member.phone, message });
}
