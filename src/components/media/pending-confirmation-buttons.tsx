"use client";

import { useState, useTransition } from "react";
import { confirmAttendanceAction, declineAttendanceAction } from "@/lib/actions/media-attendance-actions";
import { Button } from "@/components/ui/button";

// Sim/Não para uma atribuição recém-preenchida (§ pedido do usuário: widget
// de resposta assim que o membro abre o login, igual ao link de WhatsApp) —
// "Não vou poder" já dispara a mesma busca automática de substituto que o
// link sem login também dispara, então as duas formas de resposta (WhatsApp
// ou aqui dentro logado) levam ao mesmo resultado.
export function PendingConfirmationButtons({ assignmentId }: { assignmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function respond(available: boolean) {
    startTransition(async () => {
      const result = available ? await confirmAttendanceAction(assignmentId) : await declineAttendanceAction(assignmentId);
      setMessage(result.error ?? result.success ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {message && <p className="text-xs text-text-secondary">{message}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => respond(true)}>
          Sim, poderei estar
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => respond(false)}>
          Não vou poder
        </Button>
      </div>
    </div>
  );
}
