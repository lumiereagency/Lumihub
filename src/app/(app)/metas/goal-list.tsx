"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { GoalForm } from "./goal-form";
import { GoalCard } from "./goal-card";
import type { GoalGroup } from "@/lib/goals/queries";

export function GoalList({
  groups,
  currency,
  permissions,
}: {
  groups: GoalGroup[];
  currency: string;
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {permissions.canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Nova Meta
          </Button>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={<Target size={28} />}
          title="Nenhuma meta cadastrada"
          description="Defina metas de faturamento, novos clientes, prospecção, projetos, margem e recebimentos, com cenários conservador, realista e agressivo."
          action={
            permissions.canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Criar meta
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <GoalCard key={group.key} group={group} currency={currency} canEdit={permissions.canEdit} canDelete={permissions.canDelete} />
          ))}
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nova Meta">
        <GoalForm onSuccess={() => setCreating(false)} />
      </Drawer>
    </div>
  );
}
