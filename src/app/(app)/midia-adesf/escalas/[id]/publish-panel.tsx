"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { publishScheduleAction } from "@/lib/actions/media-schedule-actions";
import type { PublicationValidation } from "@/lib/media/schedule/schedule-service";
import { Button } from "@/components/ui/button";

export function PublishSchedulePanel({ scheduleId, validation }: { scheduleId: string; validation: PublicationValidation }) {
  const [pending, startTransition] = useTransition();
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);

  function publish(force: boolean) {
    startTransition(async () => {
      const result = await publishScheduleAction(scheduleId, force);
      if (result.requiresConfirmation) {
        setAwaitingConfirmation(true);
        setMessage({ error: result.error });
        return;
      }
      setAwaitingConfirmation(false);
      setMessage(result);
    });
  }

  const ready = validation.ready;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-text-primary">
          {ready ? <CheckCircle2 size={16} className="text-success" /> : <AlertTriangle size={16} className="text-error" />}
          {validation.totalEvents} evento(s) · {validation.totalAssignments} atribuição(ões)
        </span>
        <span className={validation.uncoveredMandatory > 0 ? "text-error" : "text-text-tertiary"}>
          {validation.uncoveredMandatory} função(ões) descoberta(s)
        </span>
        <span className={validation.conflicts > 0 ? "text-warning" : "text-text-tertiary"}>{validation.conflicts} conflito(s)</span>
        <span className={validation.unavailabilities > 0 ? "text-warning" : "text-text-tertiary"}>{validation.unavailabilities} indisponibilidade(s)</span>
      </div>

      {message?.error && <p className="text-sm text-error">{message.error}</p>}
      {message?.success && <p className="text-sm text-success">{message.success}</p>}

      <div className="flex items-center gap-2">
        {!ready ? (
          <Button disabled className="w-fit">
            Publicar escala
          </Button>
        ) : awaitingConfirmation ? (
          <>
            <Button variant="danger" disabled={pending} onClick={() => publish(true)} className="w-fit">
              {pending ? "Publicando..." : "Publicar mesmo assim"}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setAwaitingConfirmation(false)} className="w-fit">
              Cancelar
            </Button>
          </>
        ) : (
          <Button disabled={pending} onClick={() => publish(false)} className="w-fit">
            {pending ? "Publicando..." : "Publicar escala"}
          </Button>
        )}
      </div>
    </div>
  );
}
