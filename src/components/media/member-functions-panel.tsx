"use client";

import { useActionState, useRef, useState } from "react";
import { syncMemberFunctionsAction } from "@/lib/actions/media-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Badge } from "@/components/ui/badge";

const initialState: ActionState = {};

interface Assignment {
  functionId: string;
  isPrimary: boolean;
  status: string;
  mentorMemberId: string | null;
}

interface Row {
  checked: boolean;
  status: "EM_TREINAMENTO" | "HABILITADO" | "AVANCADO";
  isPrimary: boolean;
  mentorMemberId: string;
}

// Grade com TODAS as funções de uma vez (§ pedido do usuário: "deveria ter
// todas as funções ali") em vez de escolher uma por uma num select e clicar
// "vincular" repetidamente. Quem está "Em treinamento" ganha um select de
// mentor — o titular responsável por acompanhar aquela pessoa na função.
export function MemberFunctionsPanel({
  memberId,
  assignments,
  availableFunctions,
  mentorsByFunction,
}: {
  memberId: string;
  assignments: Assignment[];
  availableFunctions: { id: string; name: string }[];
  mentorsByFunction: Record<string, { id: string; name: string }[]>;
}) {
  const [state, formAction, pending] = useActionState(syncMemberFunctionsAction.bind(null, memberId), initialState);
  const hiddenRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const map: Record<string, Row> = {};
    for (const fn of availableFunctions) {
      const existing = assignments.find((a) => a.functionId === fn.id);
      map[fn.id] = existing
        ? { checked: true, status: existing.status as Row["status"], isPrimary: existing.isPrimary, mentorMemberId: existing.mentorMemberId ?? "" }
        : { checked: false, status: "HABILITADO", isPrimary: false, mentorMemberId: "" };
    }
    return map;
  });

  function update(functionId: string, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [functionId]: { ...prev[functionId], ...patch } }));
  }

  function setPrimary(functionId: string) {
    setRows((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) next[id] = { ...next[id], isPrimary: id === functionId };
      return next;
    });
  }

  function buildPayload() {
    return Object.entries(rows)
      .filter(([, r]) => r.checked)
      .map(([functionId, r]) => ({
        functionId,
        status: r.status,
        isPrimary: r.isPrimary,
        mentorMemberId: r.status === "EM_TREINAMENTO" && r.mentorMemberId ? r.mentorMemberId : null,
      }));
  }

  return (
    <form
      action={formAction}
      onSubmit={() => {
        if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(buildPayload());
      }}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
    >
      <input ref={hiddenRef} type="hidden" name="rows" />
      <FormMessage error={state.error} success={state.success} />

      {availableFunctions.length === 0 ? (
        <p className="text-sm text-text-tertiary">Nenhuma função cadastrada para esta organização ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {availableFunctions.map((fn) => {
            const row = rows[fn.id];
            const mentors = mentorsByFunction[fn.id] ?? [];
            return (
              <div key={fn.id} className="rounded-[10px] border border-border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(e) => update(fn.id, { checked: e.target.checked })}
                      className="h-4 w-4 rounded border-border bg-card accent-accent"
                    />
                    <span className="text-sm font-medium text-text-primary">{fn.name}</span>
                    {row.isPrimary && <Badge tone="accent">Principal</Badge>}
                  </label>

                  {row.checked && (
                    <>
                      <Select value={row.status} onChange={(e) => update(fn.id, { status: e.target.value as Row["status"] })} className="w-44">
                        <option value="EM_TREINAMENTO">Em treinamento</option>
                        <option value="HABILITADO">Habilitado</option>
                        <option value="AVANCADO">Avançado</option>
                      </Select>
                      <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <input type="radio" name="primary-radio" checked={row.isPrimary} onChange={() => setPrimary(fn.id)} className="h-3.5 w-3.5 accent-accent" />
                        Principal
                      </label>
                    </>
                  )}
                </div>

                {row.checked && row.status === "EM_TREINAMENTO" && (
                  <div className="mt-2.5 border-t border-border pt-2.5">
                    <Select
                      label="Titular responsável (mentor)"
                      value={row.mentorMemberId}
                      onChange={(e) => update(fn.id, { mentorMemberId: e.target.value })}
                    >
                      <option value="">Nenhum definido ainda</option>
                      {mentors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                    {mentors.length === 0 && (
                      <p className="mt-1 text-xs text-text-tertiary">Nenhum outro membro Habilitado/Avançado nesta função ainda para apontar como mentor.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar funções"}
      </Button>
    </form>
  );
}
