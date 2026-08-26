"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameMonth, isToday, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, MapPin, CircleDot, Circle } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/empty-state";

export interface PublicCalendarAssignment {
  functionName: string;
  memberName: string | null;
}

export interface PublicCalendarEvent {
  id: string;
  name: string;
  startAt: string;
  location: string | null;
  assignments: PublicCalendarAssignment[];
}

export function PublicScheduleCalendar({ events }: { events: PublicCalendarEvent[] }) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PublicCalendarEvent[]>();
    for (const e of events) {
      const key = format(new Date(e.startAt), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setMonth((m) => subMonths(m, 1));
            setSelectedDay(null);
          }}
          className="rounded-[10px] border border-border bg-card p-2 text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-lg font-semibold capitalize text-text-primary">{format(month, "MMMM yyyy", { locale: ptBR })}</span>
        <button
          type="button"
          onClick={() => {
            setMonth((m) => addMonths(m, 1));
            setSelectedDay(null);
          }}
          className="rounded-[10px] border border-border bg-card p-2 text-text-secondary hover:text-text-primary"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-bg-secondary text-center text-xs font-medium uppercase tracking-wide text-text-tertiary">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, month);
            const hasOpenSlot = dayEvents.some((e) => e.assignments.some((a) => !a.memberName));
            const selected = selectedDay === key;
            return (
              <button
                key={key}
                type="button"
                disabled={dayEvents.length === 0}
                onClick={() => setSelectedDay(selected ? null : key)}
                className={cn(
                  "flex min-h-[76px] flex-col items-start gap-1 border-b border-r border-border p-2 text-left transition",
                  !inMonth && "bg-bg-secondary/40",
                  dayEvents.length > 0 && "cursor-pointer hover:bg-card",
                  selected && "bg-accent/10",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    isToday(day) ? "bg-accent text-accent-on font-semibold" : inMonth ? "text-text-secondary" : "text-text-tertiary",
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <div className="flex w-full flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map((e) => (
                      <span key={e.id} className="flex items-center gap-1 truncate text-[11px] text-text-secondary">
                        {hasOpenSlot ? <CircleDot size={8} className="shrink-0 text-warning" /> : <Circle size={8} className="shrink-0 text-accent-light" />}
                        {format(new Date(e.startAt), "HH:mm")} {e.name}
                      </span>
                    ))}
                    {dayEvents.length > 2 && <span className="text-[11px] text-text-tertiary">+{dayEvents.length - 2} mais</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <Circle size={8} className="text-accent-light" /> Equipe completa
        </span>
        <span className="flex items-center gap-1.5">
          <CircleDot size={8} className="text-warning" /> Vaga em aberto
        </span>
      </div>

      {selectedDay && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {format(new Date(`${selectedDay}T00:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
          {selectedEvents.length === 0 ? (
            <EmptyState title="Nenhum culto neste dia." />
          ) : (
            selectedEvents.map((e) => (
              <div key={e.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base font-semibold text-text-primary">{e.name}</p>
                  <span className="text-sm font-medium text-accent-light">{format(new Date(e.startAt), "HH:mm")}</span>
                </div>
                {e.location && (
                  <p className="mb-3 flex items-center gap-1.5 text-sm text-text-tertiary">
                    <MapPin size={13} /> {e.location}
                  </p>
                )}
                <div className="flex flex-col divide-y divide-border">
                  {e.assignments.map((a, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-text-secondary">{a.functionName}</span>
                      <span className={cn("font-medium", a.memberName ? "text-text-primary" : "text-warning")}>{a.memberName ?? "Vaga em aberto"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
