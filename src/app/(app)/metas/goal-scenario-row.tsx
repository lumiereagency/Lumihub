"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { updateGoalAction, deleteGoalAction } from "@/lib/actions/goal-actions";
import { GOAL_SCENARIO_LABELS, formatGoalValue, GOAL_TYPES } from "@/lib/validation/goals";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SCENARIO_BAR_COLOR: Record<string, string> = {
  CONSERVADOR: "bg-text-tertiary",
  REALISTA: "bg-info",
  AGRESSIVO: "bg-accent",
};

const initialState: ActionState = {};

export function GoalScenarioRow({
  goalId,
  scenario,
  type,
  targetValue,
  achieved,
  currency,
  canEdit,
  canDelete,
}: {
  goalId: string;
  scenario: string;
  type: (typeof GOAL_TYPES)[number];
  targetValue: number;
  achieved: number;
  currency: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(updateGoalAction.bind(null, goalId), initialState);

  const progress = targetValue > 0 ? Math.min(100, (achieved / targetValue) * 100) : 0;
  const met = achieved >= targetValue;

  if (editing) {
    return (
      <form
        action={(fd) => {
          formAction(fd);
        }}
        className="flex items-end gap-2 rounded-[10px] border border-border bg-bg-secondary p-3"
      >
        <Input label={`Meta (${GOAL_SCENARIO_LABELS[scenario as keyof typeof GOAL_SCENARIO_LABELS]})`} name="targetValue" type="number" min={0.01} step="0.01" defaultValue={targetValue} className="flex-1" />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
        {state.error && <p className="text-xs text-error">{state.error}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-secondary">{GOAL_SCENARIO_LABELS[scenario as keyof typeof GOAL_SCENARIO_LABELS]}</span>
        <div className="flex items-center gap-3">
          <span className={met ? "text-sm font-medium text-success" : "text-sm text-text-primary"}>
            {formatGoalValue(type, achieved, currency)} / {formatGoalValue(type, targetValue, currency)}
          </span>
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="text-text-tertiary hover:text-text-primary" aria-label="Editar meta">
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Excluir esta meta?")) startTransition(() => deleteGoalAction(goalId));
              }}
              className="text-text-tertiary hover:text-error"
              aria-label="Excluir meta"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-card-elevated">
        <div className={`h-full rounded-full ${SCENARIO_BAR_COLOR[scenario] ?? "bg-info"}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
