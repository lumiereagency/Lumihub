import "server-only";
import { db } from "@/lib/db";
import { countMemberAssignmentsInPeriod, daysSinceLastAssignment } from "@/lib/media/schedule/schedule-service";
import type { EligibleMemberCandidate } from "@/lib/media/schedule/conflict-service";
import { rankCandidates, type AICandidateInput, type AIWeights } from "@/lib/media/ai/scoring";

export interface RankedEligibleMember extends EligibleMemberCandidate {
  aiScore: number | null;
  aiJustification: string | null;
}

// Enriquecimento por IA da lista de candidatos já existente (§15-16,
// "sugerir substituto"). Nunca esconde ninguém — mantém a filosofia já
// estabelecida no seletor manual de sempre mostrar todo mundo com avisos —
// só adiciona pontuação/justificativa a quem passaria nas restrições
// obrigatórias da IA; quem não passaria recebe aiScore null com a
// justificativa explicando o motivo (a UI decide se ordena por aiScore ou
// mantém a ordem alfabética original).
export async function rankEligibleMembers(
  organizationId: string,
  candidates: EligibleMemberCandidate[],
  functionId: string,
  periodStart: Date,
  periodEnd: Date,
  referenceDate: Date,
): Promise<RankedEligibleMember[]> {
  if (candidates.length === 0) return [];

  const settings = await db.mediaOperationsSettings.upsert({ where: { organizationId }, create: { organizationId }, update: {} });
  const weights: AIWeights = { workload: settings.aiWeightWorkload, recency: settings.aiWeightRecency, preference: settings.aiWeightPreference };

  const eligibleForScoring = candidates.filter(
    (c) => c.functionStatus !== "EM_TREINAMENTO" && c.availability !== "UNAVAILABLE" && c.conflicts.length === 0 && !c.sameEventOtherFunction,
  );

  const memberFunctions = await db.mediaMemberFunction.findMany({
    where: { functionId, memberId: { in: eligibleForScoring.map((c) => c.memberId) } },
  });
  const primaryByMember = new Map(memberFunctions.map((mf) => [mf.memberId, mf.isPrimary]));

  const inputs: AICandidateInput[] = await Promise.all(
    eligibleForScoring.map(async (c) => ({
      memberId: c.memberId,
      name: c.name,
      workloadCount: await countMemberAssignmentsInPeriod(c.memberId, periodStart, periodEnd),
      daysSinceLastAssignment: await daysSinceLastAssignment(c.memberId, referenceDate),
      isPrimaryFunction: primaryByMember.get(c.memberId) ?? false,
    })),
  );

  const scoreByMember = new Map(rankCandidates(inputs, weights).map((r) => [r.memberId, r]));

  return candidates.map((c) => {
    const ranked = scoreByMember.get(c.memberId);
    if (ranked) return { ...c, aiScore: ranked.score, aiJustification: ranked.justification };

    const reason = c.functionStatus === "EM_TREINAMENTO"
      ? "Em treinamento — fora do ranking automático"
      : c.availability === "UNAVAILABLE"
        ? "Indisponível no horário do evento"
        : c.sameEventOtherFunction
          ? "Já possui outra função neste mesmo evento"
          : "Conflito de horário com outra atribuição";
    return { ...c, aiScore: null, aiJustification: reason };
  });
}
