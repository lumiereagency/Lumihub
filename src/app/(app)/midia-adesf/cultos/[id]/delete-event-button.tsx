"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEventAction } from "@/lib/actions/media-event-actions";
import { Button } from "@/components/ui/button";

export function DeleteEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    if (!confirm(`Excluir "${eventName}"? Isso remove funções e atribuições ligadas a este evento. Não pode ser desfeito.`)) return;
    startTransition(async () => {
      const result = await deleteEventAction(eventId);
      if (!result.error) router.push("/midia-adesf/cultos");
    });
  }

  return (
    <Button type="button" variant="danger" size="sm" disabled={pending} onClick={remove}>
      <Trash2 size={14} /> {pending ? "Excluindo..." : "Excluir evento"}
    </Button>
  );
}
