// Motor de pontuação heurística da escala (§1-9 da FASE 03). Puramente
// determinístico — sem chamada a serviço externo de IA/ML e sem
// aprendizado online: os mesmos candidatos e os mesmos pesos sempre
// produzem o mesmo resultado. Os critérios obrigatórios (ativo, habilitado,
// disponível, sem conflito) já foram filtrados por quem monta os
// candidatos — este módulo só ordena quem sobrou, por preferência.

export interface AIWeights {
  workload: number;
  recency: number;
  preference: number;
}

export interface AICandidateInput {
  memberId: string;
  name: string;
  /** Quantidade de atribuições do membro dentro do período da escala. */
  workloadCount: number;
  /** Dias desde a última vez que o membro foi escalado (null = nunca). */
  daysSinceLastAssignment: number | null;
  isPrimaryFunction: boolean;
}

export interface AIRankedCandidate extends AICandidateInput {
  score: number;
  justification: string;
}

// Recência além desse teto pontua igual — evita que "não escalado há 400
// dias" domine desproporcionalmente sobre "não escalado há 90 dias".
const RECENCY_CAP_DAYS = 90;

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return (value - min) / (max - min);
}

// Ranqueia candidatos já filtrados pelas regras obrigatórias (§4-6). Usa
// normalização min-max dentro do próprio grupo de candidatos da vaga —
// "menor carga" e "maior recência" são sempre relativos a quem está
// disponível para aquela vaga específica, nunca a um valor absoluto fixo.
export function rankCandidates(candidates: AICandidateInput[], weights: AIWeights): AIRankedCandidate[] {
  if (candidates.length === 0) return [];

  const workloadValues = candidates.map((c) => c.workloadCount);
  const minWorkload = Math.min(...workloadValues);
  const maxWorkload = Math.max(...workloadValues);

  const recencyValues = candidates.map((c) =>
    c.daysSinceLastAssignment === null ? RECENCY_CAP_DAYS : Math.min(c.daysSinceLastAssignment, RECENCY_CAP_DAYS),
  );
  const minRecency = Math.min(...recencyValues);
  const maxRecency = Math.max(...recencyValues);

  const totalWeight = weights.workload + weights.recency + weights.preference;

  const ranked = candidates.map((c, i) => {
    // Carga invertida: quem tem MENOS escalas no período pontua mais alto.
    const normWorkload = 1 - normalize(c.workloadCount, minWorkload, maxWorkload);
    const normRecency = normalize(recencyValues[i], minRecency, maxRecency);
    const normPreference = c.isPrimaryFunction ? 1 : 0;

    const score =
      totalWeight === 0
        ? 0
        : ((normWorkload * weights.workload + normRecency * weights.recency + normPreference * weights.preference) / totalWeight) * 100;

    const parts: string[] = [];
    parts.push(c.workloadCount === 0 ? "sem nenhuma escala no período" : `${c.workloadCount} escala(s) no período`);
    parts.push(c.daysSinceLastAssignment === null ? "nunca foi escalado antes" : `última escala há ${c.daysSinceLastAssignment} dia(s)`);
    if (c.isPrimaryFunction) parts.push("função primária do membro");

    const justification = parts.join(" · ");

    return {
      ...c,
      score: Math.round(score * 10) / 10,
      justification: justification.charAt(0).toUpperCase() + justification.slice(1),
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}
