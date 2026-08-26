"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Users } from "lucide-react";
import { resendSwapNotificationAction, getSwapReassignCandidatesAction, reassignSwapTargetAction } from "@/lib/actions/media-swap-actions";
import type { RankedEligibleMember } from "@/lib/media/ai/candidate-ranking";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function ResendSwapNotificationButton({ swapId }: { swapId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);

  function resend() {
    startTransition(async () => {
      const result = await resendSwapNotificationAction(swapId);
      setMessage(result);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="sm" disabled={pending} onClick={resend}>
        <MessageCircle size={14} /> {pending ? "Reenviando..." : "Reenviar convite por WhatsApp"}
      </Button>
      {message?.error && <p className="text-xs text-error">{message.error}</p>}
      {message?.success && <p className="text-xs text-success">{message.success}</p>}
    </div>
  );
}

// Escolha manual de outro candidato (§ pedido do usuário: além da cascata
// automática que tenta o próximo sozinho depois de 1h sem resposta, o
// admin pode forçar a troca de candidato na hora, de dentro da própria
// plataforma) — carrega a lista só quando aberto, pra não pesar a página
// de Solicitações com uma consulta de ranking por card.
export function ReassignSwapTargetPicker({ swapId }: { swapId: string }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<RankedEligibleMember[] | null>(null);
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);

  function toggleOpen() {
    if (!open && candidates === null) {
      startTransition(async () => {
        const result = await getSwapReassignCandidatesAction(swapId);
        setCandidates(result);
      });
    }
    setOpen(!open);
  }

  function confirm() {
    if (!selected) return;
    startTransition(async () => {
      const result = await reassignSwapTargetAction(swapId, selected);
      setMessage(result);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={toggleOpen} className="w-fit text-xs text-text-secondary hover:text-text-primary hover:underline">
        <Users size={12} className="mr-1 inline" /> Escolher outra pessoa manualmente
      </button>

      {open && (
        <div className="flex flex-wrap items-center gap-2">
          {candidates === null ? (
            <p className="text-xs text-text-tertiary">Carregando candidatos...</p>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-text-tertiary">Nenhum outro candidato elegível disponível.</p>
          ) : (
            <>
              <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-64">
                <option value="">Selecione...</option>
                {candidates.map((c) => (
                  <option key={c.memberId} value={c.memberId}>
                    {c.name}
                    {c.aiScore !== null ? ` · pontuação ${c.aiScore}` : c.availability === "UNAVAILABLE" ? " · indisponível" : ""}
                  </option>
                ))}
              </Select>
              <Button type="button" size="sm" disabled={!selected || pending} onClick={confirm}>
                {pending ? "Enviando..." : "Convidar"}
              </Button>
            </>
          )}
        </div>
      )}
      {message?.error && <p className="text-xs text-error">{message.error}</p>}
      {message?.success && <p className="text-xs text-success">{message.success}</p>}
    </div>
  );
}
