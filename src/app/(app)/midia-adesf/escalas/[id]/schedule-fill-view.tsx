"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCcw, Plus, Sparkles } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SlotAssignDrawer } from "./slot-assign-drawer";

export interface ScheduleSlotData {
  functionId: string;
  functionName: string;
  slotIndex: number;
  mandatory: boolean;
  memberId: string | null;
  memberName: string | null;
  memberAvatarUrl: string | null;
  assignmentStatus: string;
  aiGenerated: boolean;
}

export interface ScheduleEventData {
  eventId: string;
  name: string;
  startAt: string;
  location: string | null;
  coverageStatus: "COMPLETE" | "INCOMPLETE" | "ATTENTION" | "SWAP_PENDING" | null;
  slots: ScheduleSlotData[];
}

const COVERAGE_BADGE: Record<string, { tone: "success" | "error" | "warning" | "info"; label: string; icon: typeof CheckCircle2 }> = {
  COMPLETE: { tone: "success", label: "Completo", icon: CheckCircle2 },
  INCOMPLETE: { tone: "error", label: "Incompleto", icon: XCircle },
  ATTENTION: { tone: "warning", label: "Atenção", icon: AlertTriangle },
  SWAP_PENDING: { tone: "info", label: "Alteração pendente", icon: RefreshCcw },
};

export function ScheduleFillView({ scheduleId, events, editable }: { scheduleId: string; events: ScheduleEventData[]; editable: boolean }) {
  const [activeSlot, setActiveSlot] = useState<{ eventId: string; eventName: string; functionId: string; functionName: string; slotIndex: number; currentMemberId: string | null } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {events.map((event) => {
        const badge = event.coverageStatus ? COVERAGE_BADGE[event.coverageStatus] : null;
        const Icon = badge?.icon;
        return (
          <div key={event.eventId} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-text-primary">{event.name}</p>
                <p className="text-xs text-text-tertiary">
                  {formatDateTime(new Date(event.startAt))}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </div>
              {badge && Icon ? (
                <Badge tone={badge.tone}>
                  <Icon size={12} /> {badge.label}
                </Badge>
              ) : (
                <Badge tone="warning">Sem funções configuradas</Badge>
              )}
            </div>

            {event.slots.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {event.slots.map((slot) => (
                  <div key={`${slot.functionId}-${slot.slotIndex}`} className="flex items-center gap-3 rounded-[8px] border border-border px-3 py-2">
                    <span className="w-40 shrink-0 text-sm text-text-secondary">
                      {slot.functionName}
                      {!slot.mandatory && <span className="text-text-tertiary"> (opcional)</span>}
                    </span>
                    {slot.memberId ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Avatar name={slot.memberName ?? "?"} src={slot.memberAvatarUrl} size="sm" />
                        <span className="text-sm text-text-primary">{slot.memberName}</span>
                        {slot.aiGenerated && (
                          <Badge tone="accent">
                            <Sparkles size={10} /> IA
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="flex-1 text-sm text-text-tertiary">Vaga aberta</span>
                    )}
                    {editable && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSlot({
                            eventId: event.eventId,
                            eventName: event.name,
                            functionId: slot.functionId,
                            functionName: slot.functionName,
                            slotIndex: slot.slotIndex,
                            currentMemberId: slot.memberId,
                          })
                        }
                        className="flex items-center gap-1 rounded-[8px] px-2 py-1 text-xs text-accent-light hover:bg-card-elevated"
                      >
                        {slot.memberId ? "Trocar" : (
                          <>
                            <Plus size={12} /> Atribuir
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <SlotAssignDrawer
        key={activeSlot ? `${activeSlot.eventId}:${activeSlot.functionId}:${activeSlot.slotIndex}` : "none"}
        scheduleId={scheduleId}
        slot={activeSlot}
        onClose={() => setActiveSlot(null)}
      />
    </div>
  );
}
