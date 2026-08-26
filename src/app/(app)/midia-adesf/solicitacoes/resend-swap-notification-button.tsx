"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { resendSwapNotificationAction } from "@/lib/actions/media-swap-actions";
import { Button } from "@/components/ui/button";

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
