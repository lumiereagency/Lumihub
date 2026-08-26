"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { sendScheduleWhatsAppAction } from "@/lib/actions/media-whatsapp-actions";
import { Button } from "@/components/ui/button";

export function SendScheduleWhatsAppButton({ scheduleId }: { scheduleId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);

  function send() {
    startTransition(async () => {
      const result = await sendScheduleWhatsAppAction(scheduleId);
      setMessage(result);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" disabled={pending} onClick={send} className="w-fit">
        <MessageCircle size={14} /> {pending ? "Enviando..." : "Enviar escala por WhatsApp"}
      </Button>
      {message?.error && <p className="text-sm text-error">{message.error}</p>}
      {message?.success && <p className="text-sm text-success">{message.success}</p>}
    </div>
  );
}
