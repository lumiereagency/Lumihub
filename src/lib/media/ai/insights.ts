import "server-only";
import { db } from "@/lib/db";
import { countMemberAssignmentsInPeriod } from "@/lib/media/schedule/schedule-service";

// Detecção de padrões (§21-22 da Fase 03) — sempre computada sob demanda a
// partir de dados reais, nunca armazenada; visível apenas para
// líderes/admins (a página que consome estas funções é protegida por
// MEDIA_ADESF_MANAGE, nunca exposta no portal do membro comum).

export interface MemberWorkloadInsight {
  memberId: string;
  name: string;
  assignmentsCount: number;
  status: "SOBRECARREGADO" | "SUBUTILIZADO" | "NORMAL";
}

// Sobrecarga/subutilização (§21) relativa à média do próprio grupo no
// período — não existe um número "certo" fixo de escalas por mês, então o
// limite é sempre calculado contra os outros membros ativos daquele mesmo
// recorte de tempo.
export async function getWorkloadInsights(organizationId: string, periodStart: Date, periodEnd: Date): Promise<MemberWorkloadInsight[]> {
  const activeMembers = await db.mediaMember.findMany({
    where: { organizationId, status: "ACTIVE" },
    include: { user: { select: { name: true } } },
  });
  if (activeMembers.length === 0) return [];

  const counts = await Promise.all(activeMembers.map((m) => countMemberAssignmentsInPeriod(m.id, periodStart, periodEnd)));
  const average = counts.reduce((sum, c) => sum + c, 0) / activeMembers.length;

  return activeMembers
    .map((m, i) => {
      const assignmentsCount = counts[i];
      let status: MemberWorkloadInsight["status"] = "NORMAL";
      if (average > 0) {
        if (assignmentsCount > average * 1.5) status = "SOBRECARREGADO";
        else if (assignmentsCount < average * 0.5) status = "SUBUTILIZADO";
      }
      return { memberId: m.id, name: m.user.name, assignmentsCount, status };
    })
    .sort((a, b) => b.assignmentsCount - a.assignmentsCount);
}

export interface SwapPatternInsights {
  totalRequests: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number | null;
  topRequesters: { memberId: string; name: string; count: number }[];
  topTargets: { memberId: string; name: string; count: number }[];
}

// Padrões de troca (§22): quem mais pede para trocar e quem mais é
// procurado como substituto, além da taxa de aprovação geral das
// solicitações já decididas pela liderança.
export async function getSwapPatternInsights(organizationId: string, sinceDate: Date): Promise<SwapPatternInsights> {
  const swaps = await db.mediaSwapRequest.findMany({
    where: { organizationId, createdAt: { gte: sinceDate } },
    include: {
      requestedBy: { include: { user: { select: { name: true } } } },
      targetMember: { include: { user: { select: { name: true } } } },
    },
  });

  const approvedCount = swaps.filter((s) => s.status === "APPROVED").length;
  const rejectedCount = swaps.filter((s) => s.status === "REJECTED" || s.status === "TARGET_REJECTED").length;
  const decided = approvedCount + rejectedCount;

  const requesterCounts = new Map<string, { name: string; count: number }>();
  const targetCounts = new Map<string, { name: string; count: number }>();
  for (const s of swaps) {
    const r = requesterCounts.get(s.requestedByMemberId) ?? { name: s.requestedBy.user.name, count: 0 };
    r.count++;
    requesterCounts.set(s.requestedByMemberId, r);

    const t = targetCounts.get(s.targetMemberId) ?? { name: s.targetMember.user.name, count: 0 };
    t.count++;
    targetCounts.set(s.targetMemberId, t);
  }

  const topRequesters = Array.from(requesterCounts.entries())
    .map(([memberId, v]) => ({ memberId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topTargets = Array.from(targetCounts.entries())
    .map(([memberId, v]) => ({ memberId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalRequests: swaps.length,
    approvedCount,
    rejectedCount,
    approvalRate: decided > 0 ? approvedCount / decided : null,
    topRequesters,
    topTargets,
  };
}

export interface ConfirmationRateInsight {
  memberId: string;
  name: string;
  totalPast: number;
  confirmedCount: number;
  noShowCount: number;
  confirmationRate: number | null;
}

// Índice de confirmação/comparecimento (§22) — só considera eventos que já
// aconteceram (event.startAt no passado): uma confirmação ainda PENDING de
// um culto futuro não é "falha", é só ainda não ter chegado a hora.
export async function getConfirmationRateInsights(organizationId: string, sinceDate: Date): Promise<ConfirmationRateInsight[]> {
  const now = new Date();
  const attendances = await db.mediaAttendance.findMany({
    where: { assignment: { event: { organizationId, startAt: { gte: sinceDate, lt: now } } } },
    include: { member: { include: { user: { select: { name: true } } } } },
  });

  const byMember = new Map<string, { name: string; total: number; confirmed: number; noShow: number }>();
  for (const att of attendances) {
    const entry = byMember.get(att.memberId) ?? { name: att.member.user.name, total: 0, confirmed: 0, noShow: 0 };
    entry.total++;
    if (att.confirmationStatus === "CONFIRMED") entry.confirmed++;
    if (att.checkinStatus === "NO_SHOW") entry.noShow++;
    byMember.set(att.memberId, entry);
  }

  return Array.from(byMember.entries())
    .map(([memberId, v]) => ({
      memberId,
      name: v.name,
      totalPast: v.total,
      confirmedCount: v.confirmed,
      noShowCount: v.noShow,
      confirmationRate: v.total > 0 ? v.confirmed / v.total : null,
    }))
    .sort((a, b) => (a.confirmationRate ?? 1) - (b.confirmationRate ?? 1));
}
