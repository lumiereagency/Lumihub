"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteScheduleAction } from "@/lib/actions/media-schedule-actions";

export function DeleteScheduleButton({ scheduleId, scheduleName }: { scheduleId: string; scheduleName: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Excluir o rascunho "${scheduleName}"? Isso apaga as atribuições já feitas nele.`)) {
          startTransition(async () => {
            await deleteScheduleAction(scheduleId);
          });
        }
      }}
      className="rounded-[8px] p-1.5 text-text-tertiary hover:bg-card-elevated hover:text-error disabled:opacity-50"
      aria-label="Excluir rascunho"
    >
      <Trash2 size={15} />
    </button>
  );
}
