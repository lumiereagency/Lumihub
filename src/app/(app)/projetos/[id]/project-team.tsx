"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { addProjectTeamMemberAction, removeProjectTeamMemberAction } from "@/lib/actions/project-actions";
import { formatCurrency } from "@/lib/format";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface TeamMemberOnProject {
  teamMemberId: string;
  name: string;
  role: string;
  roleInProject: string | null;
  costAllocated: number | null;
}

export function ProjectTeam({
  projectId,
  assigned,
  availableMembers,
  currency,
  canEdit,
}: {
  projectId: string;
  assigned: TeamMemberOnProject[];
  availableMembers: { id: string; name: string; role: string }[];
  currency: string;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const totalCost = assigned.reduce((sum, m) => sum + (m.costAllocated ?? 0), 0);

  const remainingMembers = availableMembers.filter((m) => !assigned.some((a) => a.teamMemberId === m.id));

  return (
    <div className="flex flex-col gap-3">
      {assigned.length === 0 ? (
        <EmptyState title="Nenhum membro alocado neste projeto" />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {assigned.map((m) => (
            <div key={m.teamMemberId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="text-text-primary">{m.name}</p>
                <p className="text-xs text-text-tertiary">{m.roleInProject || m.role}</p>
              </div>
              <div className="flex items-center gap-2">
                {m.costAllocated != null && <span className="text-text-secondary">{formatCurrency(m.costAllocated, currency)}</span>}
                {canEdit && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransition(() => removeProjectTeamMemberAction(projectId, m.teamMemberId))}
                    className="text-text-tertiary hover:text-error"
                    aria-label="Remover"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2.5 text-sm font-medium">
            <span className="text-text-secondary">Custo de equipe alocado</span>
            <span className="text-text-primary">{formatCurrency(totalCost, currency)}</span>
          </div>
        </div>
      )}

      {canEdit && remainingMembers.length > 0 && (
        <>
          {!formOpen ? (
            <Button variant="outline" size="sm" onClick={() => setFormOpen(true)} className="self-start">
              Adicionar membro
            </Button>
          ) : (
            <form
              action={(formData) => {
                startTransition(() => addProjectTeamMemberAction(projectId, formData));
                setFormOpen(false);
              }}
              className="flex flex-col gap-2 rounded-[10px] border border-border bg-bg-secondary p-3"
            >
              <Select name="teamMemberId" required defaultValue="">
                <option value="" disabled>
                  Selecione um membro
                </option>
                {remainingMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.role}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input name="roleInProject" placeholder="Função no projeto" />
                <Input name="costAllocated" type="number" min={0} step="0.01" placeholder="Custo (R$)" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Adicionar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
