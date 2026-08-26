"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { requestAvailabilityViaWhatsAppAction } from "@/lib/actions/media-whatsapp-actions";
import { Button } from "@/components/ui/button";

export function RequestAvailabilityButton({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);

  function send() {
    startTransition(async () => {
      const result = await requestAvailabilityViaWhatsAppAction(eventId);
      setMessage(result);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="sm" disabled={pending} onClick={send}>
        <MessageCircle size={14} /> {pending ? "Enviando..." : "Perguntar disponibilidade por WhatsApp"}
      </Button>
      {message?.error && <p className="text-xs text-error">{message.error}</p>}
      {message?.success && <p className="text-xs text-success">{message.success}</p>}
    </div>
  );
}
