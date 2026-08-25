"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { generateAIProposal } from "@/lib/media/ai/schedule-ai-service";
import type { ActionState } from "@/lib/actions/auth-actions";

// Geração assistida é ação de liderança (§10: "a IA nunca substitui a
// liderança") — MANAGE é a mesma permissão que já protege "Publicar",
// concedida a ADMIN e ao MediaMember.role LIDER via união de portal, nunca
// a um MEMBRO comum.
const MANAGE = permKey("MEDIA_ADESF", "MANAGE");

export async function generateAIProposalAction(scheduleId: string): Promise<ActionState & { filledCount?: number; unfilledNoCandidate?: number }> {
  const user = await requirePermission(MANAGE);

  const result = await generateAIProposal(scheduleId, user.organizationId, user.id);

  revalidatePath(`/midia-adesf/escalas/${scheduleId}`);

  if (result.filledCount === 0 && result.unfilledNoCandidate === 0) {
    return { success: "Nenhuma vaga vazia encontrada — a escala já está totalmente preenchida.", filledCount: 0, unfilledNoCandidate: 0 };
  }

  const parts = [`${result.filledCount} vaga(s) preenchida(s) pela IA`];
  if (result.unfilledNoCandidate > 0) parts.push(`${result.unfilledNoCandidate} vaga(s) sem candidato elegível`);

  return { success: `${parts.join(" · ")}. Revise e publique quando estiver pronto.`, filledCount: result.filledCount, unfilledNoCandidate: result.unfilledNoCandidate };
}
