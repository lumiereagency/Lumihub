"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { getEligibleMembersForSwapAction, requestSwapAction } from "@/lib/actions/media-swap-actions";
import type { EligibleMemberCandidate } from "@/lib/media/schedule/conflict-service";
import { Drawer } from "@/components/ui/drawer";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export function SwapRequestDrawer({
  assignmentId,
  eventName,
  functionName,
  onClose,
}: {
  assignmentId: string | null;
  eventName: string;
  functionName: string;
  onClose: () => void;
}) {
  const [candidates, setCandidates] = useState<EligibleMemberCandidate[] | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    getEligibleMembersForSwapAction(assignmentId).then(setCandidates);
  }, [assignmentId]);

  function send(targetMemberId: string) {
    if (!assignmentId) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("targetMemberId", targetMemberId);
      formData.set("reason", reason);
      const result = await requestSwapAction(assignmentId, {}, formData);
      if (result.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Solicitação enviada.");
        setTimeout(onClose, 1200);
      }
    });
  }

  return (
    <Drawer open={!!assignmentId} onClose={onClose} title={`Solicitar troca — ${functionName}`} description={eventName}>
      {error && <p className="mb-3 text-sm text-error">{error}</p>}
      {success && <p className="mb-3 text-sm text-success">{success}</p>}
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" rows={2} className="mb-3" />

      {candidates === null ? (
        <p className="text-sm text-text-tertiary">Carregando membros elegíveis...</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-text-tertiary">Nenhum membro elegível está disponível para esta troca. Fale com a liderança.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((c) => (
            <button
              key={c.memberId}
              type="button"
              disabled={pending}
              onClick={() => send(c.memberId)}
              className="flex items-center gap-3 rounded-[10px] border border-border px-3 py-2.5 text-left hover:bg-card disabled:opacity-50"
            >
              <Avatar name={c.name} src={c.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">{c.name}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {c.availability === "AVAILABLE" && <Badge tone="success">Disponível</Badge>}
                  {c.availability === "UNAVAILABLE" && (
                    <Badge tone="error">
                      <AlertTriangle size={11} /> Indisponível
                    </Badge>
                  )}
                  {c.conflicts.length > 0 && (
                    <Badge tone="error">
                      <Clock size={11} /> Conflito
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Drawer>
  );
}
