"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Clock, Sparkles, X } from "lucide-react";
import { getEligibleMembersForSlotAction, assignScheduleSlotAction, clearScheduleSlotAction } from "@/lib/actions/media-schedule-actions";
import type { RankedEligibleMember } from "@/lib/media/ai/candidate-ranking";
import { Drawer } from "@/components/ui/drawer";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ActiveSlot {
  eventId: string;
  eventName: string;
  functionId: string;
  functionName: string;
  slotIndex: number;
  currentMemberId: string | null;
}

export function SlotAssignDrawer({ scheduleId, slot, onClose }: { scheduleId: string; slot: ActiveSlot | null; onClose: () => void }) {
  const [candidates, setCandidates] = useState<RankedEligibleMember[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slot) return;
    getEligibleMembersForSlotAction(scheduleId, slot.eventId, slot.functionId).then((result) => {
      // Melhores sugestões da IA primeiro; quem ficou fora do ranking
      // (aiScore null) vai para o fim, mantendo-se visível com o motivo.
      setCandidates([...result].sort((a, b) => (b.aiScore ?? -1) - (a.aiScore ?? -1)));
    });
  }, [scheduleId, slot]);

  function assign(memberId: string) {
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const result = await assignScheduleSlotAction(scheduleId, slot.eventId, slot.functionId, slot.slotIndex, memberId);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  function clear() {
    if (!slot) return;
    startTransition(async () => {
      await clearScheduleSlotAction(scheduleId, slot.eventId, slot.functionId, slot.slotIndex);
      onClose();
    });
  }

  return (
    <Drawer open={!!slot} onClose={onClose} title={slot ? `${slot.functionName} — ${slot.eventName}` : ""}>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}
      {candidates === null ? (
        <p className="text-sm text-text-tertiary">Carregando candidatos...</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-text-tertiary">Nenhum membro elegível está disponível para esta função.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((c) => (
            <button
              key={c.memberId}
              type="button"
              disabled={pending}
              onClick={() => assign(c.memberId)}
              className="flex items-center gap-3 rounded-[10px] border border-border px-3 py-2.5 text-left hover:bg-card disabled:opacity-50"
            >
              <Avatar name={c.name} src={c.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm text-text-primary">{c.name}</p>
                  {c.aiScore !== null && (
                    <Badge tone="accent">
                      <Sparkles size={10} /> {c.aiScore.toFixed(0)}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {c.availability === "AVAILABLE" && <Badge tone="success">Disponível</Badge>}
                  {c.availability === "UNAVAILABLE" && (
                    <Badge tone="error">
                      <AlertTriangle size={11} /> Indisponível
                    </Badge>
                  )}
                  {c.availability === "UNKNOWN" && <Badge tone="neutral">Sem disponibilidade informada</Badge>}
                  {c.conflicts.length > 0 && (
                    <Badge tone="error">
                      <Clock size={11} /> Conflito de horário
                    </Badge>
                  )}
                  {c.sameEventOtherFunction && <Badge tone="warning">Já escalado neste culto ({c.sameEventOtherFunction})</Badge>}
                </div>
                {c.aiJustification && <p className="mt-1 text-xs text-text-tertiary">{c.aiJustification}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {slot?.currentMemberId && (
        <Button variant="danger" disabled={pending} onClick={clear} className="mt-4 w-full">
          <X size={14} /> Remover da escala
        </Button>
      )}
    </Drawer>
  );
}
