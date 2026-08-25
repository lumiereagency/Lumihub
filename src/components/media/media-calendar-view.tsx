"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameMonth, isSameDay, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, List as ListIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export interface MediaCalendarEvent {
  id: string;
  name: string;
  startAt: string;
  location: string | null;
  status: string;
  detailHref: string;
  isMine?: boolean;
}

// Calendário somente leitura do Mídia ADESF — usado tanto na área
// administrativa (/midia-adesf/calendario) quanto no portal
// (/midia/calendario, onde `isMine` destaca as próprias escalas do
// membro). Edição/cadastro sempre acontece em /midia-adesf/cultos.
export function MediaCalendarView({ events, emptyMessage }: { events: MediaCalendarEvent[]; emptyMessage: string }) {
  const [view, setView] = useState<"mes" | "lista">("mes");
  const [month, setMonth] = useState(() => new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, MediaCalendarEvent[]>();
    for (const e of events) {
      const key = format(new Date(e.startAt), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const listEvents = useMemo(() => [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()), [events]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-[10px] border border-border bg-card p-1 w-fit">
          <button
            type="button"
            onClick={() => setView("mes")}
            className={cn("flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-sm", view === "mes" ? "bg-card-elevated text-accent-light" : "text-text-secondary")}
          >
            <CalendarDays size={14} /> Mês
          </button>
          <button
            type="button"
            onClick={() => setView("lista")}
            className={cn("flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-sm", view === "lista" ? "bg-card-elevated text-accent-light" : "text-text-secondary")}
          >
            <ListIcon size={14} /> Agenda
          </button>
        </div>
        {view === "mes" && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMonth((m) => subMonths(m, 1))} className="rounded-[8px] p-1.5 text-text-secondary hover:bg-card">
              <ChevronLeft size={18} />
            </button>
            <span className="w-36 text-center text-sm font-medium capitalize text-text-primary">{format(month, "MMMM yyyy", { locale: ptBR })}</span>
            <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded-[8px] p-1.5 text-text-secondary hover:bg-card">
              <ChevronRight size={18} />
            </button>
            <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>
              Hoje
            </Button>
          </div>
        )}
      </div>

      {view === "mes" ? (
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
              const today = isSameDay(day, new Date());
              return (
                <div key={key} className={cn("min-h-[100px] border-b border-r border-border p-1.5", !inMonth && "bg-bg-secondary/40")}>
                  <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", today ? "bg-accent text-accent-on font-semibold" : inMonth ? "text-text-secondary" : "text-text-tertiary")}>
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 flex flex-col gap-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <Link
                        key={e.id}
                        href={e.detailHref}
                        className={cn(
                          "block truncate rounded-[6px] px-1.5 py-0.5 text-left text-[11px] text-text-secondary hover:text-text-primary",
                          e.isMine ? "bg-accent/20 text-accent-light" : "bg-card-elevated",
                        )}
                        title={e.name}
                      >
                        {format(new Date(e.startAt), "HH:mm")} {e.name}
                      </Link>
                    ))}
                    {dayEvents.length > 3 && <span className="text-[11px] text-text-tertiary">+{dayEvents.length - 3} mais</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : listEvents.length === 0 ? (
        <EmptyState icon={<CalendarDays size={28} />} title={emptyMessage} />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {listEvents.map((e) => (
            <Link key={e.id} href={e.detailHref} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-card">
              <div className="flex items-center gap-3">
                {e.isMine && <Badge tone="accent">Você está escalado</Badge>}
                <div>
                  <p className="text-sm text-text-primary">{e.name}</p>
                  <p className="text-xs text-text-tertiary">{e.location ?? "—"}</p>
                </div>
              </div>
              <span className="text-xs text-text-tertiary">{formatDateTime(new Date(e.startAt))}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
