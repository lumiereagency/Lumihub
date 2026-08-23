"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessageAction } from "@/lib/actions/ai-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function ChatInput({ conversationId, disabled }: { conversationId: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(sendMessageAction.bind(null, conversationId), initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef(state.success);

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      formRef.current?.reset();
    }
    successRef.current = state.success;
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 border-t border-border pt-4">
      {state.error && <p className="text-xs text-error">{state.error}</p>}
      <div className="flex items-end gap-2">
        <Textarea
          name="content"
          rows={2}
          placeholder={disabled ? "Conecte um provedor de IA para conversar." : "Pergunte algo sobre os dados da sua organização..."}
          disabled={disabled || pending}
          required
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button type="submit" disabled={disabled || pending}>
          {pending ? "Pensando..." : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
