"use client";

import { useState, useTransition } from "react";
import { respondToSwapAction, cancelSwapAction } from "@/lib/actions/media-swap-actions";
import { Button } from "@/components/ui/button";

export function RespondToSwapButtons({ swapId }: { swapId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function respond(accept: boolean) {
    startTransition(async () => {
      const result = await respondToSwapAction(swapId, accept);
      setMessage(result.error ?? result.success ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {message && <p className="text-xs text-text-secondary">{message}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => respond(true)}>
          Aceitar
        </Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => respond(false)}>
          Recusar
        </Button>
      </div>
    </div>
  );
}

export function CancelSwapButton({ swapId }: { swapId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function cancel() {
    startTransition(async () => {
      const result = await cancelSwapAction(swapId);
      setMessage(result.error ?? result.success ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {message && <p className="text-xs text-text-secondary">{message}</p>}
      <Button size="sm" variant="outline" disabled={pending} onClick={cancel}>
        Cancelar solicitação
      </Button>
    </div>
  );
}
