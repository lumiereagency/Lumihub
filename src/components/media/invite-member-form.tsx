"use client";

import { useActionState, useState } from "react";
import { inviteMediaMemberAction } from "@/lib/actions/media-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

// Selecionar as funções já no convite (em vez de só depois, na tela do
// membro) evita a "escala vazia": um membro sem nenhuma função vinculada
// nunca aparece como candidato para o preenchimento manual nem para a
// geração por IA (ambos partem de MediaMemberFunction).
export function InviteMemberForm({
  onSuccess,
  availableFunctions,
}: {
  onSuccess?: () => void;
  availableFunctions: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(inviteMediaMemberAction, initialState);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string>("");

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (primaryId === id) setPrimaryId("");
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />
      <Input label="Nome" name="name" required />
      <Input label="E-mail" name="email" type="email" required hint="Se já existir uma conta LUMIBASE com este e-mail, ela será vinculada automaticamente." />
      <Input label="Telefone (opcional)" name="phone" placeholder="(11) 90000-0000" />
      <Select label="Papel no Mídia ADESF" name="role" defaultValue="MEMBRO" required>
        <option value="MEMBRO">Membro</option>
        <option value="LIDER">Líder</option>
      </Select>

      {availableFunctions.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">Funções (opcional)</label>
          <div className="flex flex-col gap-1.5 rounded-[10px] border border-border p-3">
            {availableFunctions.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    name="functionIds"
                    value={f.id}
                    checked={checked.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="h-4 w-4 rounded border-border bg-card accent-accent"
                  />
                  {f.name}
                </label>
                {checked.has(f.id) && (
                  <label className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <input
                      type="radio"
                      name="primaryFunctionId"
                      value={f.id}
                      checked={primaryId === f.id}
                      onChange={() => setPrimaryId(f.id)}
                      className="h-3.5 w-3.5 border-border accent-accent"
                    />
                    Principal
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Enviando..." : "Convidar"}
      </Button>
      {state.success && onSuccess && (
        <Button type="button" variant="secondary" onClick={onSuccess}>
          Fechar
        </Button>
      )}
    </form>
  );
}
