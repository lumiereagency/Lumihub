"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import {
  updateMyAvailabilityAction,
  addMyAvailabilityExceptionAction,
  deleteMyAvailabilityExceptionAction,
  respondPendingSpecialEventAction,
} from "@/lib/actions/media-portal-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

const initialState: ActionState = {};
const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
// Mesmos dias de src/lib/media/schedule/availability-service.ts — mantidos
// como literal aqui porque este arquivo é "use client" e não pode importar
// código server-only.
const WEEKDAY_COVERAGE_DAYS = [3, 5];

export function WeekdayCoverageBanner({ satisfied, monthLabel }: { satisfied: boolean; monthLabel: string }) {
  if (satisfied) {
    return (
      <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-text-primary">
        <CheckCircle2 size={18} className="shrink-0 text-success" />
        <span>Você já tem disponibilidade de meio de semana registrada para {monthLabel}. Obrigado!</span>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-primary">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
      <span>
        Falta marcar pelo menos <strong>uma quarta ou sexta-feira</strong> disponível em {monthLabel}. Pode ser um único dia específico —
        o resto da semana continua livre para você decidir.
      </span>
    </div>
  );
}

interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  available: boolean;
}

interface CultTime {
  startTime: string;
  endTime: string;
}

export function WeeklyAvailabilityForm({
  initialSlots,
  defaultTimesByDay = {},
}: {
  initialSlots: Slot[];
  defaultTimesByDay?: Record<number, CultTime>;
}) {
  const [state, formAction, pending] = useActionState(updateMyAvailabilityAction, initialState);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [slots, setSlots] = useState<Slot[]>(() =>
    DAY_LABELS.map((_, dayOfWeek) => {
      const existing = initialSlots.find((s) => s.dayOfWeek === dayOfWeek);
      if (existing) return existing;
      // Sem preferência salva ainda — sugere o horário real do culto
      // daquele dia (§ pedido do usuário: "08:00–12:00 não tem nada a ver
      // com nossas decisões internas") em vez de um placeholder genérico
      // que não corresponde a nenhum culto de verdade.
      const cultTime = defaultTimesByDay[dayOfWeek];
      return { dayOfWeek, startTime: cultTime?.startTime ?? "08:00", endTime: cultTime?.endTime ?? "12:00", available: false };
    }),
  );

  function updateSlot(dayOfWeek: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, ...patch } : s)));
  }

  return (
    <form
      action={formAction}
      onSubmit={() => {
        if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(slots.filter((s) => s.available));
      }}
      className="flex flex-col gap-4"
    >
      <input ref={hiddenRef} type="hidden" name="slots" />
      <FormMessage error={state.error} success={state.success} />
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="px-4 py-3 font-medium">Dia</th>
              <th className="px-4 py-3 font-medium">Disponível</th>
              <th className="px-4 py-3 font-medium">Início</th>
              <th className="px-4 py-3 font-medium">Fim</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr
                key={slot.dayOfWeek}
                className={`border-b border-border last:border-0 ${WEEKDAY_COVERAGE_DAYS.includes(slot.dayOfWeek) ? "bg-warning/5" : ""}`}
              >
                <td className="px-4 py-3 text-text-primary">
                  {DAY_LABELS[slot.dayOfWeek]}
                  {WEEKDAY_COVERAGE_DAYS.includes(slot.dayOfWeek) && (
                    <Badge tone="warning" className="ml-2 align-middle text-[10px] uppercase tracking-wide">
                      meio de semana
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={slot.available}
                    onChange={(e) => updateSlot(slot.dayOfWeek, { available: e.target.checked })}
                    className="h-4 w-4 rounded border-border bg-card accent-[var(--lh-accent)]"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={slot.startTime}
                    disabled={!slot.available}
                    onChange={(e) => updateSlot(slot.dayOfWeek, { startTime: e.target.value })}
                    className="h-9 rounded-[8px] border border-border bg-card px-2 text-sm text-text-primary disabled:opacity-40"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={slot.endTime}
                    disabled={!slot.available}
                    onChange={(e) => updateSlot(slot.dayOfWeek, { endTime: e.target.value })}
                    className="h-9 rounded-[8px] border border-border bg-card px-2 text-sm text-text-primary disabled:opacity-40"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar disponibilidade"}
      </Button>
    </form>
  );
}

interface Exception {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  reason: string | null;
}

export function AvailabilityExceptionsPanel({ exceptions }: { exceptions: Exception[] }) {
  const [state, formAction, pending] = useActionState(addMyAvailabilityExceptionAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <FormMessage error={state.error} success={state.success} />
        <Input label="Data" name="date" type="date" required />
        <Input label="Motivo (opcional)" name="reason" placeholder="Viagem, compromisso, etc." />
        <Input label="Início" name="startTime" type="time" defaultValue="08:00" required />
        <Input label="Fim" name="endTime" type="time" defaultValue="12:00" required />
        <label className="flex items-center gap-2 text-sm text-text-secondary sm:col-span-2">
          <input type="checkbox" name="available" className="h-4 w-4 rounded border-border bg-card accent-[var(--lh-accent)]" />
          Marcar como disponível neste horário (em vez de indisponível)
        </label>
        <Button type="submit" disabled={pending} className="self-start sm:col-span-2">
          {pending ? "Adicionando..." : "Adicionar exceção"}
        </Button>
      </form>

      {exceptions.length > 0 && (
        <div className="flex flex-col gap-2">
          {exceptions.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between rounded-[10px] border border-border bg-card px-4 py-2.5 text-sm">
              <div>
                <span className="font-medium text-text-primary">{new Date(ex.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>{" "}
                <span className="text-text-tertiary">
                  {ex.startTime}–{ex.endTime}
                  {ex.reason ? ` · ${ex.reason}` : ""}
                </span>
                <Badge tone={ex.available ? "success" : "neutral"} className="ml-2">
                  {ex.available ? "Disponível" : "Indisponível"}
                </Badge>
              </div>
              <form action={deleteMyAvailabilityExceptionAction.bind(null, ex.id)}>
                <button type="submit" className="text-xs text-error hover:underline">
                  Remover
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SpecialEvent {
  eventId: string;
  name: string;
  startAt: string;
  location: string | null;
}

export function PendingSpecialEventsPanel({ events }: { events: SpecialEvent[] }) {
  const [pending, startTransition] = useTransition();
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);

  function respond(eventId: string, available: boolean) {
    setPendingEventId(eventId);
    startTransition(async () => {
      await respondPendingSpecialEventAction(eventId, available);
      setRespondedIds((prev) => new Set(prev).add(eventId));
      setPendingEventId(null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => {
        const answered = respondedIds.has(event.eventId);
        return (
          <div key={event.eventId} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-4 py-3 text-sm">
            <div>
              <span className="font-medium text-text-primary">{event.name}</span>{" "}
              <span className="text-text-tertiary">
                {formatDateTime(new Date(event.startAt))}
                {event.location ? ` · ${event.location}` : ""}
              </span>
            </div>
            {answered ? (
              <Badge tone="success">
                <CheckCircle2 size={12} /> Respondido
              </Badge>
            ) : (
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={pending && pendingEventId === event.eventId} onClick={() => respond(event.eventId, true)}>
                  Disponível
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending && pendingEventId === event.eventId}
                  onClick={() => respond(event.eventId, false)}
                >
                  Não vou poder
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
