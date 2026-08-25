import { MessageSquareText } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { MEDIA_SWAP_STATUS_LABELS, MEDIA_SWAP_STATUS_TONE } from "@/lib/media/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RespondToSwapButtons, CancelSwapButton } from "./swap-actions";

export default async function MediaPortalRequestsPage() {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const [received, sent] = await Promise.all([
    db.mediaSwapRequest.findMany({
      where: { targetMemberId: member.id },
      include: { requestedBy: { include: { user: { select: { name: true } } } }, assignment: { include: { event: true, function: true } } },
      orderBy: { requestedAt: "desc" },
    }),
    db.mediaSwapRequest.findMany({
      where: { requestedByMemberId: member.id },
      include: { targetMember: { include: { user: { select: { name: true } } } }, assignment: { include: { event: true, function: true } } },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  const pendingReceived = received.filter((s) => s.status === "PENDING_TARGET");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Solicitações" description="Trocas de escala enviadas e recebidas." />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Aguardando sua resposta</h2>
        {pendingReceived.length === 0 ? (
          <EmptyState icon={<MessageSquareText size={24} />} title="Nenhuma solicitação pendente" />
        ) : (
          <div className="flex flex-col gap-3">
            {pendingReceived.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-text-primary">
                  <strong>{s.requestedBy.user.name}</strong> solicitou que você assuma:
                </p>
                <p className="text-xs text-text-tertiary">
                  {s.assignment.function.name} em {s.assignment.event.name} · {s.assignment.event.startAt.toLocaleString("pt-BR")}
                </p>
                {s.reason && <p className="mt-1 text-xs text-text-tertiary">Motivo: {s.reason}</p>}
                <div className="mt-3">
                  <RespondToSwapButtons swapId={s.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Enviadas por você</h2>
        {sent.length === 0 ? (
          <EmptyState icon={<MessageSquareText size={24} />} title="Nenhuma solicitação enviada ainda" />
        ) : (
          <div className="flex flex-col gap-2">
            {sent.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm text-text-primary">
                    Para {s.targetMember.user.name} — {s.assignment.function.name} em {s.assignment.event.name}
                  </p>
                  <Badge tone={MEDIA_SWAP_STATUS_TONE[s.status]}>{MEDIA_SWAP_STATUS_LABELS[s.status]}</Badge>
                </div>
                {["PENDING_TARGET", "PENDING_LEADER"].includes(s.status) && <CancelSwapButton swapId={s.id} />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
