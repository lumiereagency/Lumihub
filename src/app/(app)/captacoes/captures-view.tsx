"use client";

import { useState } from "react";
import { Plus, Camera } from "lucide-react";
import { createCaptureAction, updateCaptureAction } from "@/lib/actions/capture-actions";
import { CAPTURE_STATUS_LABELS } from "@/lib/validation/captures";
import { formatDateTime } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CaptureForm, type CaptureFormValues } from "./capture-form";

interface CaptureRow {
  id: string;
  clientId: string;
  projectId: string | null;
  date: string;
  location: string | null;
  status: string;
  videomaker: string | null;
  photographer: string | null;
  storymaker: string | null;
  droneOperator: string | null;
  videoCount: number | null;
  photoCount: number | null;
  scriptNotes: string | null;
  equipment: string | null;
  clientName: string;
  projectName: string | null;
}

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "gold"> = {
  PLANEJADA: "neutral",
  CONFIRMADA: "info",
  REALIZADA: "success",
  EM_EDICAO: "warning",
  ENTREGUE: "gold",
};

function toFormValues(c: CaptureRow): CaptureFormValues {
  return {
    clientId: c.clientId,
    projectId: c.projectId,
    date: c.date,
    location: c.location,
    status: c.status,
    videomaker: c.videomaker,
    photographer: c.photographer,
    storymaker: c.storymaker,
    droneOperator: c.droneOperator,
    videoCount: c.videoCount,
    photoCount: c.photoCount,
    scriptNotes: c.scriptNotes,
    equipment: c.equipment,
  };
}

export function CapturesView({
  captures,
  clients,
  projects,
  permissions,
}: {
  captures: CaptureRow[];
  clients: { id: string; companyName: string }[];
  projects: { id: string; name: string }[];
  permissions: { canCreate: boolean; canEdit: boolean };
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? captures.find((c) => c.id === editingId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        {permissions.canCreate && (
          <Button onClick={() => setCreating(true)} disabled={clients.length === 0}>
            <Plus size={16} /> Nova Captação
          </Button>
        )}
      </div>

      {clients.length === 0 && <p className="text-sm text-text-tertiary">Cadastre um cliente antes de agendar uma captação.</p>}

      {captures.length === 0 ? (
        <EmptyState
          icon={<Camera size={28} />}
          title="Nenhuma captação agendada"
          description="Agende captações com equipe, equipamentos e status de entrega."
          action={
            permissions.canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Agendar captação
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Local</th>
                <th className="px-4 py-3 font-medium">Equipe</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {captures.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-card">
                  <td className="px-4 py-3 text-text-secondary">{formatDateTime(new Date(c.date))}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{c.clientName}</p>
                    {c.projectName && <p className="text-xs text-text-tertiary">{c.projectName}</p>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{c.location ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-text-tertiary">
                    {[c.videomaker, c.photographer, c.storymaker, c.droneOperator].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>
                      {CAPTURE_STATUS_LABELS[c.status as keyof typeof CAPTURE_STATUS_LABELS] ?? c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {permissions.canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingId(c.id)}
                        className="rounded-[8px] px-2 py-1 text-xs text-text-secondary hover:bg-card-elevated hover:text-text-primary"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nova Captação">
        <CaptureForm action={createCaptureAction} clients={clients} projects={projects} submitLabel="Agendar captação" onSuccess={() => setCreating(false)} />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title="Editar Captação">
        {editing && (
          <CaptureForm
            key={editing.id}
            action={updateCaptureAction.bind(null, editing.id)}
            defaultValues={toFormValues(editing)}
            clients={clients}
            projects={projects}
            submitLabel="Salvar alterações"
          />
        )}
      </Drawer>
    </div>
  );
}
