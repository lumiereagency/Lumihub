"use client";

import { useActionState, useState } from "react";
import { createMediaFunctionAction, updateMediaFunctionAction, deleteMediaFunctionAction } from "@/lib/actions/media-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";

const initialState: ActionState = {};

interface FunctionRow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  membersCount: number;
}

export function FunctionsPanel({ functions }: { functions: FunctionRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = functions.find((f) => f.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          Nova função
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {functions.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-[10px] border border-border bg-card px-4 py-2.5">
            <div>
              <span className="text-sm font-medium text-text-primary">{f.name}</span>{" "}
              <Badge tone={f.active ? "success" : "neutral"}>{f.active ? "Ativa" : "Inativa"}</Badge>
              {f.description && <p className="text-xs text-text-tertiary">{f.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditingId(f.id)} className="text-xs text-accent-light hover:underline">
                Editar
              </button>
              {f.membersCount === 0 && (
                <form action={deleteMediaFunctionAction.bind(null, f.id)}>
                  <button type="submit" className="text-xs text-error hover:underline">
                    Excluir
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nova função">
        <FunctionForm action={createMediaFunctionAction} onSuccess={() => setCreating(false)} />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing?.name ?? ""}>
        {editing && (
          <FunctionForm
            key={editing.id}
            action={updateMediaFunctionAction.bind(null, editing.id)}
            defaultValues={editing}
            onSuccess={() => setEditingId(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function FunctionForm({
  action,
  defaultValues,
  onSuccess,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: { name: string; description: string | null; active: boolean };
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />
      <Input label="Nome" name="name" defaultValue={defaultValues?.name} required />
      <Input label="Descrição (opcional)" name="description" defaultValue={defaultValues?.description ?? ""} />
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} className="h-4 w-4 rounded border-border bg-card accent-accent" />
        Função ativa
      </label>
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : "Salvar"}
      </Button>
      {state.success && (
        <Button type="button" variant="secondary" onClick={onSuccess}>
          Fechar
        </Button>
      )}
    </form>
  );
}
