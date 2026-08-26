import { Send } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { MEDIA_SWAP_STATUS_LABELS, MEDIA_SWAP_STATUS_TONE } from "@/lib/media/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SwapDecisionForm } from "./swap-decision-form";
import { ResendSwapNotificationButton } from "./resend-swap-notification-button";

export default async function MediaAdesfSwapRequestsPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));

  const swaps = await db.mediaSwapRequest.findMany({
    where: { organizationId: user.organizationId },
    include: {
      requestedBy: { include: { user: { select: { name: true } } } },
      targetMember: { include: { user: { select: { name: true } } } },
      assignment: { include: { event: true, function: true } },
    },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  const pendingLeader = swaps.filter((s) => s.status === "PENDING_LEADER");
  // Aguardando o substituto responder — inclui as sugestões automáticas da
  // IA (§ pedido do usuário: "consta alteração pendente... a alteração é
  // feita automaticamente?"). Antes ficava misturado no histórico sem
  // nenhuma ação possível; se o convite por WhatsApp nunca chegou (ex:
  // WhatsApp desconectado no momento), ficava preso aqui pra sempre sem
  // ninguém perceber.
  const pendingTarget = swaps.filter((s) => s.status === "PENDING_TARGET");
  const others = swaps.filter((s) => s.status !== "PENDING_LEADER" && s.status !== "PENDING_TARGET");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Solicitações" description="Trocas de escala pendentes e histórico." />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Aguardando aprovação</h2>
        {pendingLeader.length === 0 ? (
          <EmptyState icon={<Send size={28} />} title="Nenhuma troca aguardando aprovação" />
        ) : (
          <div className="flex flex-col gap-3">
            {pendingLeader.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-text-primary">
                  <strong>{s.requestedBy.user.name}</strong> → <strong>{s.targetMember.user.name}</strong>
                </p>
                <p className="text-xs text-text-tertiary">
                  {s.assignment.function.name} em {s.assignment.event.name} · {s.assignment.event.startAt.toLocaleString("pt-BR")}
                </p>
                {s.reason && <p className="mt-1 text-xs text-text-tertiary">Motivo: {s.reason}</p>}
                <div className="mt-3">
                  <SwapDecisionForm swapId={s.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Aguardando resposta do substituto</h2>
        {pendingTarget.length === 0 ? (
          <EmptyState icon={<Send size={28} />} title="Nenhuma troca aguardando resposta" />
        ) : (
          <div className="flex flex-col gap-3">
            {pendingTarget.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-text-primary">
                  <strong>{s.requestedBy.user.name}</strong> → <strong>{s.targetMember.user.name}</strong>
                </p>
                <p className="text-xs text-text-tertiary">
                  {s.assignment.function.name} em {s.assignment.event.name} · {s.assignment.event.startAt.toLocaleString("pt-BR")}
                </p>
                {s.reason && <p className="mt-1 text-xs text-text-tertiary">Motivo: {s.reason}</p>}
                <p className="mt-1 text-xs text-text-tertiary">
                  {s.targetMember.phone ? "Convite enviado por WhatsApp — se não chegou, reenvie abaixo." : "Este membro não tem telefone cadastrado — avise manualmente."}
                </p>
                {s.targetMember.phone && (
                  <div className="mt-3">
                    <ResendSwapNotificationButton swapId={s.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Histórico</h2>
        {others.length === 0 ? (
          <EmptyState icon={<Send size={28} />} title="Nenhuma solicitação registrada ainda" />
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
            {others.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="text-text-primary">
                    {s.requestedBy.user.name} → {s.targetMember.user.name}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {s.assignment.function.name} em {s.assignment.event.name}
                  </p>
                </div>
                <Badge tone={MEDIA_SWAP_STATUS_TONE[s.status]}>{MEDIA_SWAP_STATUS_LABELS[s.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
