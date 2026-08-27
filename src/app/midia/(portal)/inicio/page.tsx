import Link from "next/link";
import { Sparkles, Clock, Bell, CalendarClock, ClipboardCheck, Send, History, Percent, AlertTriangle, ArrowRight, UserCheck } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { AssignmentCard, type AssignmentCardData } from "@/components/media/assignment-card";
import { PendingConfirmationButtons } from "@/components/media/pending-confirmation-buttons";
import { RespondToSwapButtons } from "@/app/midia/(portal)/solicitacoes/swap-actions";
import { getWeekdayCoverageStatus, getPendingSpecialEvents } from "@/lib/media/schedule/availability-service";
import { formatDateTime } from "@/lib/format";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Estrutura exigida pela especificação (§35/§36): Minha Próxima Escala /
// Minha Função / Minha Disponibilidade / Avisos, com os contadores reais do
// dashboard do membro (escalas do mês, confirmações pendentes,
// solicitações) — nenhum dado é simulado.
export default async function MediaPortalHomePage() {
  const user = await requireMediaMember();

  const member = await db.mediaMember.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      functions: { include: { function: true } },
      availabilityRecurring: { orderBy: { dayOfWeek: "asc" } },
    },
  });

  const primaryFunction = member.functions.find((f) => f.isPrimary)?.function.name ?? null;
  const enabledFunctions = member.functions.filter((f) => !f.isPrimary).map((f) => f.function.name);

  const [coverage, pendingSpecialEvents] = await Promise.all([
    getWeekdayCoverageStatus(member.id),
    getPendingSpecialEvents(user.organizationId, member.id),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [nextAssignment, assignmentsThisMonth, pendingConfirmations, pendingSwaps, notifications] = await Promise.all([
    db.mediaScheduleAssignment.findFirst({
      where: { memberId: member.id, schedule: { status: "PUBLISHED" }, event: { startAt: { gte: now } } },
      include: { event: true, function: true, attendance: true },
      orderBy: { event: { startAt: "asc" } },
    }),
    db.mediaScheduleAssignment.count({
      where: { memberId: member.id, schedule: { status: "PUBLISHED" }, event: { startAt: { gte: monthStart, lte: monthEnd } } },
    }),
    db.mediaAttendance.count({
      where: { memberId: member.id, confirmationStatus: "PENDING", assignment: { event: { startAt: { gte: now } } } },
    }),
    db.mediaSwapRequest.count({
      where: { OR: [{ requestedByMemberId: member.id }, { targetMemberId: member.id }], status: { in: ["PENDING_TARGET", "PENDING_LEADER"] } },
    }),
    db.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  // "Ações pendentes" (§ pedido do usuário: widget que aparece assim que o
  // membro entra, igual à mensagem de WhatsApp) — troca de colega aguardando
  // resposta e atribuição nova/substituição ainda sem confirmação, as duas
  // coisas que hoje só chegavam por WhatsApp ou pelo sininho escondido.
  const [pendingSwapsAsTarget, pendingConfirmationAssignments] = await Promise.all([
    db.mediaSwapRequest.findMany({
      where: { targetMemberId: member.id, status: "PENDING_TARGET" },
      include: { requestedBy: { include: { user: { select: { name: true } } } }, assignment: { include: { event: true, function: true } } },
      orderBy: { requestedAt: "asc" },
    }),
    db.mediaScheduleAssignment.findMany({
      where: {
        memberId: member.id,
        schedule: { status: "PUBLISHED" },
        event: { startAt: { gte: now } },
        OR: [{ attendance: null }, { attendance: { confirmationStatus: "PENDING" } }],
      },
      include: { event: true, function: true },
      orderBy: { event: { startAt: "asc" } },
    }),
  ]);

  // "Meu desempenho" (Fase 03, §22): sempre um recorte individual — nunca
  // compara com outros membros nem expõe a posição do membro num ranking.
  const [pastAttendances, recentHistory] = await Promise.all([
    db.mediaAttendance.findMany({
      where: { memberId: member.id, assignment: { event: { startAt: { lt: now } } } },
      select: { confirmationStatus: true, checkinStatus: true },
    }),
    db.mediaScheduleAssignment.findMany({
      where: { memberId: member.id, event: { startAt: { lt: now } } },
      include: { event: true, function: true },
      orderBy: { event: { startAt: "desc" } },
      take: 5,
    }),
  ]);
  const confirmedCount = pastAttendances.filter((a) => a.confirmationStatus === "CONFIRMED").length;
  const noShowCount = pastAttendances.filter((a) => a.checkinStatus === "NO_SHOW").length;
  const attendanceRate = pastAttendances.length > 0 ? Math.round((confirmedCount / pastAttendances.length) * 100) : null;

  const nextCard: AssignmentCardData | null = nextAssignment
    ? {
        assignmentId: nextAssignment.id,
        eventName: nextAssignment.event.name,
        startAt: nextAssignment.event.startAt.toISOString(),
        location: nextAssignment.event.location,
        functionName: nextAssignment.function.name,
        confirmationStatus: nextAssignment.attendance?.confirmationStatus ?? "PENDING",
        checkinStatus: nextAssignment.attendance?.checkinStatus ?? "PENDING",
        isPast: false,
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}.`} description="Bem-vindo à Mídia ADESF." />

      {(!coverage.satisfied || pendingSpecialEvents.length > 0) && (
        <Link
          href="/midia/disponibilidade"
          className="flex items-center gap-3 rounded-2xl p-4 text-sm text-[var(--lh-accent-on)] transition hover:brightness-105"
          style={{ background: "var(--lh-accent-gradient)" }}
        >
          <AlertTriangle size={20} className="shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Complete sua disponibilidade de {coverage.monthLabel}</p>
            <p className="opacity-90">
              {!coverage.satisfied && "Falta marcar pelo menos 1 quarta ou sexta-feira disponível este mês"}
              {!coverage.satisfied && pendingSpecialEvents.length > 0 && " · "}
              {pendingSpecialEvents.length > 0 &&
                `${pendingSpecialEvents.length} culto${pendingSpecialEvents.length > 1 ? "s" : ""} especial${pendingSpecialEvents.length > 1 ? "is" : ""} aguardando sua resposta`}
            </p>
          </div>
          <ArrowRight size={18} className="shrink-0" />
        </Link>
      )}

      {(pendingSwapsAsTarget.length > 0 || pendingConfirmationAssignments.length > 0) && (
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-accent-light">
            <UserCheck size={14} /> Ações pendentes
          </h2>
          <div className="flex flex-col gap-3">
            {pendingSwapsAsTarget.map((s) => (
              <div key={s.id} className="rounded-2xl border border-accent/40 bg-card p-4">
                <p className="text-sm text-text-primary">
                  <strong>{s.requestedBy.user.name}</strong> pediu que você cubra:
                </p>
                <p className="text-xs text-text-tertiary">
                  {s.assignment.function.name} em {s.assignment.event.name} · {formatDateTime(s.assignment.event.startAt)}
                </p>
                {s.reason && <p className="mt-1 text-xs text-text-tertiary">Motivo: {s.reason}</p>}
                <div className="mt-3">
                  <RespondToSwapButtons swapId={s.id} />
                </div>
              </div>
            ))}
            {pendingConfirmationAssignments.map((a) => (
              <div key={a.id} className="rounded-2xl border border-accent/40 bg-card p-4">
                <p className="text-sm text-text-primary">
                  Você foi escalado(a) como <strong>{a.function.name}</strong>:
                </p>
                <p className="text-xs text-text-tertiary">
                  {a.event.name} · {formatDateTime(a.event.startAt)}
                </p>
                <div className="mt-3">
                  <PendingConfirmationButtons assignmentId={a.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Escalas do mês" value={String(assignmentsThisMonth)} icon={<CalendarClock size={18} />} />
        <MetricCard label="Confirmações pendentes" value={String(pendingConfirmations)} icon={<ClipboardCheck size={18} />} />
        <MetricCard label="Solicitações em andamento" value={String(pendingSwaps)} icon={<Send size={18} />} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Minha próxima escala</h2>
        {nextCard ? <AssignmentCard data={nextCard} /> : (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-text-secondary">Nenhuma escala disponível.</p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Minha função</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">
            <Sparkles size={12} /> {primaryFunction ?? "Não definida"}
          </Badge>
          {enabledFunctions.map((name) => (
            <Badge key={name} tone="neutral">
              {name}
            </Badge>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Minha disponibilidade</h2>
        {member.availabilityRecurring.length === 0 ? (
          <p className="mb-3 text-sm text-text-secondary">Você ainda não configurou sua disponibilidade.</p>
        ) : (
          <div className="mb-3 flex flex-wrap gap-2">
            {member.availabilityRecurring.map((s) => (
              <Badge key={s.id} tone="neutral">
                {DAY_LABELS[s.dayOfWeek]} {s.startTime}–{s.endTime}
              </Badge>
            ))}
          </div>
        )}
        <Link
          href="/midia/disponibilidade"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card-elevated px-3 py-1.5 text-sm font-medium text-text-primary hover:brightness-110"
        >
          <Clock size={14} /> Atualizar disponibilidade
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Avisos</h2>
        {notifications.length === 0 ? (
          <EmptyState icon={<Bell size={24} />} title="Nenhum aviso no momento" />
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => (
              <div key={n.id} className="rounded-[10px] border border-border bg-card px-4 py-3">
                <p className="text-sm font-medium text-text-primary">{n.title}</p>
                <p className="text-sm text-text-secondary">{n.body}</p>
                <p className="mt-1 text-xs text-text-tertiary">{formatDateTime(n.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Meu desempenho</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Participações no mês" value={String(assignmentsThisMonth)} icon={<CalendarClock size={18} />} />
          <MetricCard
            label="Índice de presença"
            value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
            icon={<Percent size={18} />}
          />
          <MetricCard label="Ausências registradas" value={String(noShowCount)} icon={<History size={18} />} />
        </div>
        {recentHistory.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            {recentHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-[8px] border border-border px-3 py-2 text-sm">
                <span className="text-text-primary">
                  {h.function.name} — {h.event.name}
                </span>
                <span className="text-text-tertiary">{formatDateTime(h.event.startAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
