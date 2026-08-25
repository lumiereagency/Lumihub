"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { generateAIProposalAction } from "@/lib/actions/media-ai-actions";
import { Button } from "@/components/ui/button";

// Botão "Gerar Escala com IA" (§10-13): dispara o motor heurístico, que só
// preenche vagas ainda vazias e nunca publica sozinho — o retorno é sempre
// uma mensagem de apoio para o líder revisar antes de publicar.
export function GenerateAIScheduleButton({ scheduleId }: { scheduleId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);

  function generate() {
    startTransition(async () => {
      const result = await generateAIProposalAction(scheduleId);
      setMessage(result);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" disabled={pending} onClick={generate} className="w-fit">
        <Sparkles size={14} /> {pending ? "Gerando..." : "Gerar Escala com IA"}
      </Button>
      {message?.error && <p className="text-sm text-error">{message.error}</p>}
      {message?.success && <p className="text-sm text-success">{message.success}</p>}
    </div>
  );
}
