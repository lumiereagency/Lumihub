"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { createContractTemplateAction } from "@/lib/actions/contract-actions";
import { CONTRACT_TYPES, CONTRACT_TYPE_LABELS, TEMPLATE_PLACEHOLDERS } from "@/lib/validation/contracts";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function TemplateForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState(createContractTemplateAction, initialState);
  const successRef = useRef(state.success);

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      onSuccess?.();
    }
    successRef.current = state.success;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />

      <Input label="Nome do modelo" name="name" required placeholder="Ex: Contrato de Social Media" />

      <Select label="Tipo" name="type" defaultValue="CLIENTE">
        {CONTRACT_TYPES.map((t) => (
          <option key={t} value={t}>
            {CONTRACT_TYPE_LABELS[t]}
          </option>
        ))}
      </Select>

      <Textarea label="Texto do modelo" name="bodyTemplate" rows={10} required placeholder="Cláusulas do contrato, usando os placeholders abaixo..." />

      <div className="rounded-[10px] border border-border bg-card p-3 text-xs text-text-tertiary">
        <p className="mb-1.5 font-medium text-text-secondary">Placeholders disponíveis</p>
        <ul className="flex flex-col gap-0.5">
          {TEMPLATE_PLACEHOLDERS.map((p) => (
            <li key={p.key}>
              <code className="text-gold-light">{p.key}</code> — {p.description}
            </li>
          ))}
        </ul>
      </div>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : "Criar modelo"}
      </Button>
    </form>
  );
}
