"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { aiTemplateAction, createMessageTemplateAction, updateMessageTemplateAction } from "@/lib/actions/billing-actions";
import { AiWriter } from "@/components/ai/ai-writer";
import type { ActionState } from "@/lib/actions/auth-actions";
import { MESSAGE_TRIGGERS, MESSAGE_TRIGGER_LABELS, REMINDER_CHANNELS, REMINDER_CHANNEL_LABELS, TEMPLATE_PLACEHOLDERS } from "@/lib/validation/billing";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export interface TemplateValues {
  id: string;
  name: string;
  trigger: string;
  channel: string;
  body: string;
  active: boolean;
}

export function TemplateForm({ onSuccess, template }: { onSuccess?: () => void; template?: TemplateValues }) {
  const [state, formAction, pending] = useActionState(template ? updateMessageTemplateAction.bind(null, template.id) : createMessageTemplateAction, initialState);
  const successRef = useRef(state.success);
  const [trigger, setTrigger] = useState(template?.trigger ?? "D_0");
  const [body, setBody] = useState(template?.body ?? "");

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

      <Input label="Nome do modelo" name="name" required placeholder="Ex: Lembrete amigável" defaultValue={template?.name} />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Quando enviar" name="trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {MESSAGE_TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {MESSAGE_TRIGGER_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select label="Canal" name="channel" defaultValue={template?.channel ?? "WHATSAPP"}>
          {REMINDER_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {REMINDER_CHANNEL_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>

      <AiWriter
        hasText={body.trim().length > 0}
        generate={({ tone, instructions }) => aiTemplateAction({ trigger, tone, instructions, current: body })}
        onResult={setBody}
      />

      <Textarea
        label="Mensagem"
        name="body"
        rows={9}
        required
        placeholder="Oi, {{nome}}! A fatura de {{descricao}}, no valor de {{valor}}, vence em {{vencimento}}. Para pagar: {{link}}"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="rounded-xl border border-border bg-card p-3 text-xs text-text-tertiary">
        <p className="mb-1.5 font-medium text-text-secondary">Campos que a base preenche sozinha</p>
        <ul className="flex flex-col gap-0.5">
          {TEMPLATE_PLACEHOLDERS.map((p) => (
            <li key={p.key}>
              <code className="text-accent-light">{p.key}</code> — {p.description}
            </li>
          ))}
        </ul>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="active" defaultChecked={template?.active ?? true} className="h-4 w-4 rounded border-border bg-card accent-[var(--lh-accent)]" />
        Ativo
      </label>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : template ? "Salvar modelo" : "Criar modelo"}
      </Button>
    </form>
  );
}
