"use client";

import { useActionState } from "react";
import { assignMemberFunctionAction, removeMemberFunctionAction } from "@/lib/actions/media-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { MEDIA_FUNCTION_ASSIGNMENT_LABELS } from "@/lib/media/labels";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Badge } from "@/components/ui/badge";

const initialState: ActionState = {};

interface Assignment {
  functionId: string;
  functionName: string;
  isPrimary: boolean;
  status: string;
}

export function MemberFunctionsPanel({
  memberId,
  assignments,
  availableFunctions,
}: {
  memberId: string;
  assignments: Assignment[];
  availableFunctions: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignMemberFunctionAction.bind(null, memberId), initialState);
  const assignedIds = new Set(assignments.map((a) => a.functionId));
  const remaining = availableFunctions.filter((f) => !assignedIds.has(f.id));

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      {assignments.length === 0 ? (
        <p className="text-sm text-text-tertiary">Nenhuma função vinculada ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {assignments.map((a) => (
            <div key={a.functionId} className="flex items-center justify-between rounded-[10px] border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-primary">{a.functionName}</span>
                {a.isPrimary && <Badge tone="accent">Principal</Badge>}
                <Badge tone="neutral">{MEDIA_FUNCTION_ASSIGNMENT_LABELS[a.status]}</Badge>
              </div>
              <form action={removeMemberFunctionAction.bind(null, memberId, a.functionId)}>
                <button type="submit" className="text-xs text-error hover:underline">
                  Remover
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {remaining.length > 0 && (
        <form action={formAction} className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <FormMessage error={state.error} success={state.success} />
          <Select label="Função" name="functionId" required defaultValue="">
            <option value="" disabled>
              Selecione...
            </option>
            {remaining.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Select label="Nível" name="status" defaultValue="HABILITADO">
            <option value="EM_TREINAMENTO">Em treinamento</option>
            <option value="HABILITADO">Habilitado</option>
            <option value="AVANCADO">Avançado</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-text-secondary sm:col-span-2">
            <input type="checkbox" name="isPrimary" className="h-4 w-4 rounded border-border bg-card accent-accent" />
            Definir como função principal
          </label>
          <Button type="submit" disabled={pending} className="self-start sm:col-span-2">
            {pending ? "Vinculando..." : "Vincular função"}
          </Button>
        </form>
      )}
    </div>
  );
}
