"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Repeat, Clapperboard } from "lucide-react";
import { createEventAction } from "@/lib/actions/media-event-actions";
import { MEDIA_EVENT_STATUS_LABELS, MEDIA_EVENT_STATUS_TONE } from "@/lib/media/labels";
import { formatDateTime } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EventForm } from "./event-form";
import { RecurrenceForm } from "./recurrence-form";

interface EventRow {
  id: string;
  name: string;
  type: string;
  startAt: string;
  status: string;
  location: string | null;
  requirementsCount: number;
}

export function EventList({ events, allFunctions }: { events: EventRow[]; allFunctions: { id: string; name: string }[] }) {
  const [creating, setCreating] = useState(false);
  const [creatingRecurrence, setCreatingRecurrence] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => setCreatingRecurrence(true)}>
          <Repeat size={16} /> Nova série recorrente
        </Button>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> Novo culto/evento
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<Clapperboard size={28} />}
          title="Nenhum culto ou evento cadastrado ainda"
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> Novo culto/evento
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">Local</th>
                <th className="px-4 py-3 font-medium">Funções</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-card">
                  <td className="px-4 py-3">
                    <Link href={`/midia-adesf/cultos/${e.id}`} className="font-medium text-text-primary hover:underline">
                      {e.name}
                    </Link>
                    <p className="text-xs text-text-tertiary">{e.type}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatDateTime(new Date(e.startAt))}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.location ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {e.requirementsCount === 0 ? <Badge tone="warning">Sem funções</Badge> : e.requirementsCount}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={MEDIA_EVENT_STATUS_TONE[e.status]}>{MEDIA_EVENT_STATUS_LABELS[e.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo culto/evento">
        <EventForm action={createEventAction} allFunctions={allFunctions} submitLabel="Criar" onSuccess={() => setCreating(false)} />
      </Drawer>

      <Drawer open={creatingRecurrence} onClose={() => setCreatingRecurrence(false)} title="Nova série recorrente">
        <RecurrenceForm allFunctions={allFunctions} onSuccess={() => setCreatingRecurrence(false)} />
      </Drawer>
    </div>
  );
}
