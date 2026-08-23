import { GOAL_TYPE_LABELS } from "@/lib/validation/goals";
import { formatDate } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { GoalGroup } from "@/lib/goals/queries";
import { GoalScenarioRow } from "./goal-scenario-row";

export function GoalCard({
  group,
  currency,
  canEdit,
  canDelete,
}: {
  group: GoalGroup;
  currency: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{GOAL_TYPE_LABELS[group.type]}</CardTitle>
          <p className="mt-1 text-xs text-text-tertiary">
            {formatDate(new Date(group.periodStart))} — {formatDate(new Date(group.periodEnd))}
          </p>
        </div>
      </CardHeader>
      <div className="flex flex-col gap-4">
        {group.scenarios.map((s) => (
          <GoalScenarioRow
            key={s.goalId}
            goalId={s.goalId}
            scenario={s.scenario}
            type={group.type}
            targetValue={s.targetValue}
            achieved={group.achieved}
            currency={currency}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}
      </div>
    </Card>
  );
}
