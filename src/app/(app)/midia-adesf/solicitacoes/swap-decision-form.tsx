"use client";

import { useActionState, useState } from "react";
import { decideSwapAction } from "@/lib/actions/media-swap-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function SwapDecisionForm({ swapId }: { swapId: string }) {
  const [notes, setNotes] = useState("");
  const approveAction = decideSwapAction.bind(null, swapId, true);
  const rejectAction = decideSwapAction.bind(null, swapId, false);
  const [approveState, approveFormAction, approvePending] = useActionState(approveAction, initialState);
  const [rejectState, rejectFormAction, rejectPending] = useActionState(rejectAction, initialState);
  const pending = approvePending || rejectPending;

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border p-3">
      <FormMessage error={approveState.error ?? rejectState.error} success={approveState.success ?? rejectState.success} />
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações da decisão (opcional)" rows={2} />
      <div className="flex gap-2">
        <form action={approveFormAction}>
          <input type="hidden" name="decisionNotes" value={notes} />
          <Button type="submit" size="sm" disabled={pending}>
            {approvePending ? "Aprovando..." : "Aprovar"}
          </Button>
        </form>
        <form action={rejectFormAction}>
          <input type="hidden" name="decisionNotes" value={notes} />
          <Button type="submit" size="sm" variant="danger" disabled={pending}>
            {rejectPending ? "Recusando..." : "Recusar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
