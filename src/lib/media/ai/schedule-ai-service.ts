import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assignScheduleSlot, countMemberAssignmentsInPeriod, daysSinceLastAssignment } from "@/lib/media/schedule/schedule-service";
import { findScheduleConflicts, findSameEventOtherFunction, getMemberAvailabilityState } from "@/lib/media/schedule/conflict-service";
import { rankCandidates, type AICandidateInput } from "@/lib/media/ai/scoring";

export interface AIGenerationResult {
  runId: string;
  slotsEvaluated: number;
  filledCount: number;
  skippedAlreadyFilled: number;
  unfilledNoCandidate: number;
}

// Motor de geração assistida da escala (§1-14). Reaproveita 100% do
// caminho de preenchimento manual já existente (assignScheduleSlot) — a IA
// nunca escreve na atribuição por fora dele e nunca chama publishSchedule:
// toda vaga que ela preenche fica com o mesmo status ASSIGNED de um
// preenchimento humano, sujeita ao botão "Publicar" já existente (§10/§54).
// Idempotente e incremental: vagas já preenchidas (manual ou por execução
// anterior da IA) nunca são sobrescritas, então pode ser chamada de novo
// só para completar o que ainda falta.
export async function generateAIProposal(scheduleId: string, organizationId: string, requestedByUserId: string): Promise<AIGenerationResult> {
  const schedule = await db.mediaSchedule.findFirst({ where: { id: scheduleId, organizationId } });
  if (!schedule) throw new Error("Escala não encontrada.");

  const settings = await db.mediaOperationsSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
  const weights = {
    workload: settings.aiWeightWorkload,
    recency: settings.aiWeightRecency,
    preference: settings.aiWeightPreference,
  };

  const events = await db.mediaEvent.findMany({
    where: { organizationId, startAt: { gte: schedule.periodStart, lte: schedule.periodEnd }, status: { notIn: ["CANCELLED", "ARCHIVED"] } },
    include: { requirements: true },
    orderBy: { startAt: "asc" },
  });

  const run = await db.mediaAIGenerationRun.create({
    data: { organizationId, scheduleId, requestedByUserId, weightsSnapshot: weights },
  });

  let slotsEvaluated = 0;
  let filledCount = 0;
  let skippedAlreadyFilled = 0;
  let unfilledNoCandidate = 0;

  for (const event of events) {
    // Um mesmo membro nunca recebe duas funções no mesmo culto DENTRO desta
    // execução — mais estrito que o seletor manual (que só avisa), evitando
    // que a heurística concentre um único voluntário em várias vagas do
    // mesmo evento só porque ele pontuou bem em todas elas.
    const usedInEventThisRun = new Set<string>();

    for (const requirement of event.requirements) {
      for (let slotIndex = 0; slotIndex < requirement.requiredQuantity; slotIndex++) {
        const existing = await db.mediaScheduleAssignment.findUnique({
          where: { scheduleId_eventId_functionId_slotIndex: { scheduleId, eventId: event.id, functionId: requirement.functionId, slotIndex } },
        });
        if (existing?.memberId) {
          skippedAlreadyFilled++;
          continue;
        }

        slotsEvaluated++;

        const memberFunctions = await db.mediaMemberFunction.findMany({
          where: {
            functionId: requirement.functionId,
            status: { not: "EM_TREINAMENTO" },
            member: { organizationId, status: "ACTIVE" },
          },
          include: { member: { include: { user: { select: { name: true } } } } },
        });

        const candidateInputs: AICandidateInput[] = [];
        for (const mf of memberFunctions) {
          if (usedInEventThisRun.has(mf.memberId)) continue;

          const [availability, conflicts, sameEvent] = await Promise.all([
            getMemberAvailabilityState(mf.memberId, event.startAt, event.endAt),
            findScheduleConflicts(mf.memberId, event.startAt, event.endAt),
            findSameEventOtherFunction(mf.memberId, event.id),
          ]);
          // Restrições obrigatórias (§4-6): nunca escala inativo (já
          // filtrado na query), não habilitado (já filtrado na query),
          // indisponível ou em conflito de horário/evento.
          if (availability === "UNAVAILABLE" || conflicts.length > 0 || sameEvent) continue;

          const [workloadCount, recency] = await Promise.all([
            countMemberAssignmentsInPeriod(mf.memberId, schedule.periodStart, schedule.periodEnd),
            daysSinceLastAssignment(mf.memberId, event.startAt),
          ]);

          candidateInputs.push({
            memberId: mf.memberId,
            name: mf.member.user.name,
            workloadCount,
            daysSinceLastAssignment: recency,
            isPrimaryFunction: mf.isPrimary,
          });
        }

        const winner = rankCandidates(candidateInputs, weights)[0] ?? null;

        if (!winner) {
          unfilledNoCandidate++;
          await db.mediaAISuggestion.create({
            data: {
              runId: run.id,
              eventId: event.id,
              functionId: requirement.functionId,
              slotIndex,
              justification: "Nenhum candidato elegível encontrado (ativo, habilitado, disponível e sem conflito de horário).",
            },
          });
          continue;
        }

        usedInEventThisRun.add(winner.memberId);
        await assignScheduleSlot(scheduleId, event.id, requirement.functionId, slotIndex, winner.memberId, requestedByUserId, organizationId, {
          aiGenerated: true,
        });
        filledCount++;

        const assignment = await db.mediaScheduleAssignment.findUniqueOrThrow({
          where: { scheduleId_eventId_functionId_slotIndex: { scheduleId, eventId: event.id, functionId: requirement.functionId, slotIndex } },
        });

        await db.mediaAISuggestion.create({
          data: {
            runId: run.id,
            eventId: event.id,
            functionId: requirement.functionId,
            slotIndex,
            assignmentId: assignment.id,
            suggestedMemberId: winner.memberId,
            score: winner.score,
            justification: winner.justification,
          },
        });
      }
    }
  }

  const finishedRun = await db.mediaAIGenerationRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      durationMs: Date.now() - run.startedAt.getTime(),
      suggestionsCount: slotsEvaluated,
      filledCount,
    },
  });

  await audit({
    organizationId,
    userId: requestedByUserId,
    action: "MEDIA_AI_GENERATION_RUN",
    entityType: "MediaSchedule",
    entityId: scheduleId,
    metadata: { runId: run.id, slotsEvaluated, filledCount, skippedAlreadyFilled, unfilledNoCandidate, weights },
  });

  return { runId: finishedRun.id, slotsEvaluated, filledCount, skippedAlreadyFilled, unfilledNoCandidate };
}
