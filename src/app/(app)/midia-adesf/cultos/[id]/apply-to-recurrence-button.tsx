"use client";

import { useState, useTransition } from "react";
import { Repeat } from "lucide-react";
import { applyEventRequirementsToRecurrenceAction } from "@/lib/actions/media-event-actions";

// "Editar as funções de UM culto também altera todo o resto da série" —
// grava as funções salvas neste culto como template da recorrência e
// reescreve todas as ocorrências futuras da mesma série de uma vez.
export function ApplyToRecurrenceButton({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);

  function apply() {
    startTransition(async () => {
      const result = await applyEventRequirementsToRecurrenceAction(eventId);
      setMessage(result);
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <button type="button" disabled={pending} onClick={apply} className="flex w-fit items-center gap-1.5 text-xs text-accent-light hover:underline disabled:opacity-50">
        <Repeat size={12} /> {pending ? "Aplicando..." : "Aplicar estas funções a toda a série"}
      </button>
      {message?.error && <p className="text-xs text-error">{message.error}</p>}
      {message?.success && <p className="text-xs text-success">{message.success}</p>}
    </div>
  );
}
