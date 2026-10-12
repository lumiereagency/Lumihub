"use client";

import { useState, useTransition } from "react";
import { BellRing, CheckCircle2, Clock, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { setQuoteFollowUpEnabledAction, setQuoteFollowUpPausedAction } from "@/lib/actions/quote-actions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface FollowUpItem {
  step: string;
  label: string;
  // enviado | falhou | proximo | aguardando
  state: "sent" | "failed" | "next";
  when: string | null;
}

export function FollowUpCard({
  proposalId,
  enabled,
  paused,
  whatsapp,
  hasPhone,
  stopped,
  items,
  canManage,
}: {
  proposalId: string;
  enabled: boolean;
  paused: boolean;
  whatsapp: boolean;
  hasPhone: boolean;
  stopped: string | null;
  items: FollowUpItem[];
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const active = enabled && !paused && !stopped && whatsapp && hasPhone;

  let status = "Ativo";
  let tone: "success" | "neutral" | "warning" = "success";
  if (stopped) [status, tone] = [stopped, "neutral"];
  else if (!enabled) [status, tone] = ["Desligado para a empresa", "neutral"];
  else if (paused) [status, tone] = ["Pausado neste orçamento", "warning"];
  else if (!whatsapp) [status, tone] = ["WhatsApp desconectado", "warning"];
  else if (!hasPhone) [status, tone] = ["Falta o WhatsApp do cliente", "warning"];

  return (
    <section className="mx-auto mt-6 flex max-w-[1100px] flex-col gap-4 rounded-3xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card-elevated text-accent-light">
            <BellRing size={18} />
          </span>
          <div>
            <p className="text-[17px] font-semibold tracking-tight text-text-primary">Acompanhamento automático</p>
            <p className="text-sm text-text-tertiary">A base lembra o cliente por WhatsApp, de segunda a sábado, das 9h às 18h, e para quando ele responde.</p>
          </div>
        </div>
        <Badge tone={tone}>{status}</Badge>
      </header>

      <ol className="flex flex-col divide-y divide-border rounded-2xl border border-border">
        {items.length === 0 && <li className="px-4 py-3 text-sm text-text-tertiary">Nada agendado: o orçamento ainda não foi enviado ou já teve resposta.</li>}
        {items.map((i) => (
          <li key={i.step} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-2.5 text-text-primary">
              {i.state === "sent" ? <CheckCircle2 size={15} className="shrink-0 text-success" /> : i.state === "failed" ? <XCircle size={15} className="shrink-0 text-error" /> : <Clock size={15} className="shrink-0 text-text-tertiary" />}
              <span className="truncate">{i.label}</span>
            </span>
            <span className={cn("shrink-0 text-xs", i.state === "failed" ? "text-error" : "text-text-tertiary")}>
              {i.state === "sent" ? `Enviado ${i.when}` : i.state === "failed" ? `Falhou ${i.when}` : `Previsto ${i.when}`}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        {!stopped && enabled && (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setQuoteFollowUpPausedAction(proposalId, !paused);
                setMsg(r.ok ? (paused ? "Acompanhamento retomado." : "Acompanhamento pausado.") : (r.error ?? "Não foi possível."));
              })
            }
          >
            {paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />} {paused ? "Retomar neste orçamento" : "Pausar neste orçamento"}
          </Button>
        )}
        {canManage && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (enabled && !confirm("Desligar o acompanhamento automático de todos os orçamentos?")) return;
              start(async () => {
                const r = await setQuoteFollowUpEnabledAction(!enabled);
                setMsg(r.ok ? (enabled ? "Acompanhamento desligado para a empresa." : "Ligado. Vale para orçamentos enviados a partir de agora.") : (r.error ?? "Não foi possível."));
              });
            }}
          >
            {enabled ? "Desligar para todos" : "Ligar para todos"}
          </Button>
        )}
        {msg && <span className="text-xs text-text-secondary">{msg}</span>}
      </div>
      {!active && !stopped && enabled && !paused && <p className="text-xs text-warning">Enquanto isso não for resolvido, nenhuma mensagem sai.</p>}
    </section>
  );
}
