import "server-only";
import { db } from "@/lib/db";
import { computeCommission } from "@/lib/pricing/commission";

// Ordem natural das etapas: integral, depois sinal, depois quitação.
export const STAGE_ORDER: Record<string, number> = { INTEGRAL: 0, SINAL: 1, QUITACAO: 2 };
export const byStage = (a: { stage: string }, b: { stage: string }) => (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9);

// Gera os lançamentos de comissão quando o cliente aceita o orçamento.
// Idempotente (único por orçamento + etapa). Quem vendeu = quem criou o
// orçamento; sem isso, o responsável pelo lead.
export async function createCommissionsForProposal(proposalId: string): Promise<number> {
  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    include: { items: true, lead: { select: { ownerUserId: true } }, commissions: { select: { id: true } } },
  });
  if (!proposal || proposal.status !== "ACEITA" || proposal.commissions.length) return 0;

  const result = computeCommission(
    proposal.items.map((i) => ({
      name: i.name,
      billing: i.billing,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      commissionPercent: i.commissionPercent != null ? Number(i.commissionPercent) : null,
      commissionFixed: i.commissionFixed != null ? Number(i.commissionFixed) : null,
      commissionSplit: i.commissionSplit,
    })),
    Number(proposal.discountPercent),
  );
  if (result.total <= 0) return 0;

  const sellerUserId = proposal.createdByUserId ?? proposal.lead?.ownerUserId ?? null;
  const base = { organizationId: proposal.organizationId, proposalId, sellerUserId };
  const entries: { stage: string; description: string; amount: number; lines: typeof result.lines }[] = [];
  if (result.integral > 0) entries.push({ stage: "INTEGRAL", description: "Comissão integral", amount: result.integral, lines: result.lines.filter((l) => !l.split) });
  if (result.split > 0) {
    const half = Math.round((result.split / 2) * 100) / 100;
    const splitLines = result.lines.filter((l) => l.split);
    entries.push({ stage: "SINAL", description: "Evento · 50% no sinal", amount: half, lines: splitLines });
    entries.push({ stage: "QUITACAO", description: "Evento · 50% na quitação", amount: Math.round((result.split - half) * 100) / 100, lines: splitLines });
  }

  await db.commission.createMany({
    data: entries.map((e) => ({ ...base, stage: e.stage, description: e.description, amount: e.amount, breakdown: e.lines as unknown as object })),
    skipDuplicates: true,
  });
  return entries.length;
}
