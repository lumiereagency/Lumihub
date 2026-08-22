"use client";

import { useActionState, useEffect, useRef } from "react";
import { createMessageTemplateAction } from "@/lib/actions/billing-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { MESSAGE_TRIGGERS, MESSAGE_TRIGGER_LABELS, REMINDER_CHANNELS, REMINDER_CHANNEL_LABELS, TEMPLATE_PLACEHOLDERS } from "@/lib/validation/billing";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function TemplateForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState(createMessageTemplateAction, initialState);
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

      <Input label="Nome do modelo" name="name" required placeholder="Ex: Lembrete D-3" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Gatilho" name="trigger" defaultValue="D_0">
          {MESSAGE_TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {MESSAGE_TRIGGER_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select label="Canal" name="channel" defaultValue="WHATSAPP">
          {REMINDER_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {REMINDER_CHANNEL_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>

      <Textarea label="Mensagem" name="body" rows={5} required placeholder="Olá, {{nome}}. Sua cobrança de {{valor}} vence em {{vencimento}}." />

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

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-border bg-card accent-[#C9A45C]" />
        Ativo
      </label>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : "Criar modelo"}
      </Button>
    </form>
  );
}
