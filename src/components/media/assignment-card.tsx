"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, RefreshCcw, MapPin } from "lucide-react";
import { confirmAttendanceAction, checkInAction } from "@/lib/actions/media-attendance-actions";
import { MEDIA_CONFIRMATION_STATUS_LABELS } from "@/lib/media/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SwapRequestDrawer } from "@/components/media/swap-request-drawer";

export interface AssignmentCardData {
  assignmentId: string;
  eventName: string;
  startAt: string;
  location: string | null;
  functionName: string;
  confirmationStatus: string;
  checkinStatus: string;
  isPast: boolean;
}

const CONFIRMATION_TONE: Record<string, "success" | "warning" | "neutral" | "error"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  DECLINED: "neutral",
  EXPIRED: "error",
};

export function AssignmentCard({ data }: { data: AssignmentCardData }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const date = new Date(data.startAt);
  const isToday = new Date().toDateString() === date.toDateString();

  function confirm() {
    startTransition(async () => {
      const result = await confirmAttendanceAction(data.assignmentId);
      setMessage(result.error ?? result.success ?? null);
    });
  }

  function checkIn() {
    startTransition(async () => {
      const result = await checkInAction(data.assignmentId);
      setMessage(result.error ?? result.success ?? null);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-tertiary">
            {format(date, "EEEE · dd 'de' MMM · HH:mm", { locale: ptBR })}
          </p>
          <p className="mt-1 font-medium text-text-primary">{data.eventName}</p>
          {data.location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-text-tertiary">
              <MapPin size={11} /> {data.location}
            </p>
          )}
        </div>
        <Badge tone="accent">{data.functionName}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={CONFIRMATION_TONE[data.confirmationStatus]}>{MEDIA_CONFIRMATION_STATUS_LABELS[data.confirmationStatus]}</Badge>
        {data.checkinStatus === "CHECKED_IN" && <Badge tone="success">Check-in feito</Badge>}
      </div>

      {message && <p className="mt-2 text-xs text-text-secondary">{message}</p>}

      {!data.isPast && (
        <div className="mt-3 flex flex-wrap gap-2">
          {data.confirmationStatus === "PENDING" && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={confirm}>
              <CheckCircle2 size={14} /> Confirmar presença
            </Button>
          )}
          {isToday && data.checkinStatus === "PENDING" && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={checkIn}>
              Estou presente
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setSwapOpen(true)}>
            <RefreshCcw size={14} /> Solicitar troca
          </Button>
        </div>
      )}

      <SwapRequestDrawer
        assignmentId={swapOpen ? data.assignmentId : null}
        eventName={data.eventName}
        functionName={data.functionName}
        onClose={() => setSwapOpen(false)}
      />
    </div>
  );
}
