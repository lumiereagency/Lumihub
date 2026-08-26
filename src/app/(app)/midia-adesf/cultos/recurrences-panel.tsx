"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toggleRecurrenceActiveAction, deleteRecurrenceAction } from "@/lib/actions/media-event-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export interface RecurrenceRow {
  id: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string | null;
  active: boolean;
  eventsCount: number;
}

// Gestão das séries recorrentes — antes só existia a tela de criar; não
// havia como ver o que já foi criado, pausar ou desfazer uma série
// inteira. Pausar (toggle) só impede novas ocorrências futuras; excluir
// apaga a série e TODAS as ocorrências já geradas por ela de uma vez.
export function RecurrencesPanel({ recurrences }: { recurrences: RecurrenceRow[] }) {
  const [pending, startTransition] = useTransition();

  if (recurrences.length === 0) return null;

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      await toggleRecurrenceActiveAction(id, active);
    });
  }

  function remove(id: string, name: string, eventsCount: number) {
    if (confirm(`Excluir a série "${name}" e as ${eventsCount} ocorrência(s) já geradas por ela? Isso remove as atribuições feitas nelas também. Não pode ser desfeito.`)) {
      startTransition(async () => {
        await deleteRecurrenceAction(id);
      });
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border p-4">
      <p className="text-sm font-medium text-text-secondary">Séries recorrentes</p>
      {recurrences.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border bg-card px-4 py-2.5">
          <div>
            <p className="text-sm font-medium text-text-primary">{r.name}</p>
            <p className="text-xs text-text-tertiary">
              {DAY_LABELS[r.dayOfWeek]} {r.startTime}
              {r.endTime ? `–${r.endTime}` : ""} · {r.eventsCount} ocorrência(s) geradas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Ativa" : "Pausada"}</Badge>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => toggle(r.id, !r.active)}>
              {r.active ? "Pausar" : "Reativar"}
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(r.id, r.name, r.eventsCount)}
              className="rounded-[8px] p-1.5 text-text-tertiary hover:bg-card-elevated hover:text-error disabled:opacity-50"
              aria-label="Excluir série"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
