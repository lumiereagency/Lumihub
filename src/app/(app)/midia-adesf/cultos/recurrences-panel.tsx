"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toggleRecurrenceActiveAction, deleteRecurrenceAction, updateRecurrenceAction } from "@/lib/actions/media-event-actions";
import { RecurrenceForm } from "./recurrence-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export interface RecurrenceRow {
  id: string;
  name: string;
  type: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  eventsCount: number;
  requirements: { functionId: string; requiredQuantity: number; mandatory: boolean }[];
}

// Gestão das séries recorrentes — antes só existia a tela de criar; não
// havia como ver o que já foi criado, editar, pausar ou desfazer uma
// série inteira. Pausar (toggle) só impede novas ocorrências futuras;
// editar sincroniza nome/tipo/local/horário/funções com as ocorrências
// futuras já geradas; excluir apaga a série e TODAS as ocorrências de uma
// vez.
export function RecurrencesPanel({
  recurrences,
  allFunctions,
}: {
  recurrences: RecurrenceRow[];
  allFunctions: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (recurrences.length === 0) return null;

  const editing = recurrences.find((r) => r.id === editingId) ?? null;

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
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditingId(r.id)}
              className="rounded-[8px] p-1.5 text-text-tertiary hover:bg-card-elevated hover:text-accent-light disabled:opacity-50"
              aria-label="Editar série"
            >
              <Pencil size={15} />
            </button>
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

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing ? `Editar série — ${editing.name}` : ""}>
        {editing && (
          <RecurrenceForm
            action={updateRecurrenceAction.bind(null, editing.id)}
            defaultValues={editing}
            allFunctions={allFunctions}
            submitLabel="Salvar alterações"
            onSuccess={() => setEditingId(null)}
          />
        )}
      </Drawer>
    </div>
  );
}
