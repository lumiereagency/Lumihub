"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateProjectAction } from "@/lib/actions/project-actions";
import { PROJECT_STATUS_LABELS } from "@/lib/validation/projects";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ProjectForm, type ProjectFormValues } from "../project-form";

interface ProjectData {
  id: string;
  clientId: string;
  name: string;
  responsibleUserId: string | null;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  value: number | null;
  costEstimate: number | null;
  clientName: string;
  responsibleName: string | null;
}

const STATUS_TONE: Record<string, "success" | "neutral" | "info" | "error" | "warning" | "accent"> = {
  BACKLOG: "neutral",
  PLANEJAMENTO: "info",
  EM_PRODUCAO: "accent",
  EM_REVISAO: "warning",
  AGUARDANDO_CLIENTE: "info",
  CONCLUIDO: "success",
  ATRASADO: "error",
};

export function ProjectDetailHeader({
  project,
  clients,
  users,
  permissions,
}: {
  project: ProjectData;
  clients: { id: string; companyName: string }[];
  users: { id: string; name: string }[];
  permissions: { canEdit: boolean };
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[project.status] ?? "neutral"}>
              {PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS] ?? project.status}
            </Badge>
            <span className="text-sm text-text-tertiary">{project.clientName}</span>
          </div>
          <p className="text-sm text-text-secondary">Responsável: {project.responsibleName ?? "Sem responsável"}</p>
        </div>
        {permissions.canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Editar
          </Button>
        )}
      </div>

      <Drawer open={editing} onClose={() => setEditing(false)} title="Editar projeto">
        <ProjectForm
          action={updateProjectAction.bind(null, project.id)}
          defaultValues={
            {
              clientId: project.clientId,
              name: project.name,
              responsibleUserId: project.responsibleUserId,
              status: project.status,
              startDate: project.startDate,
              dueDate: project.dueDate,
              value: project.value,
              costEstimate: project.costEstimate,
            } as ProjectFormValues
          }
          clients={clients}
          users={users}
          submitLabel="Salvar alterações"
          onSuccess={() => setEditing(false)}
        />
      </Drawer>
    </Card>
  );
}
