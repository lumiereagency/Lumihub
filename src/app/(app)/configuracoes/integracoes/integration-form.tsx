"use client";

import { useActionState, useEffect, useRef } from "react";
import { connectIntegrationAction } from "@/lib/actions/integration-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import type { ProviderDefinition } from "@/lib/integrations/providers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function IntegrationForm({
  provider,
  currentConfig,
  credentialPreviews,
  onSuccess,
}: {
  provider: ProviderDefinition;
  currentConfig: Record<string, string>;
  credentialPreviews: Record<string, string>;
  onSuccess?: () => void;
}) {
  const action = connectIntegrationAction.bind(null, provider.key);
  const [state, formAction, pending] = useActionState(action, initialState);
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

      {provider.oauthOnly && (
        <p className="rounded-[10px] border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          Este provedor usa OAuth. As credenciais abaixo ficam salvas no LUMIHUB Vault, mas o fluxo completo de login e
          consentimento ainda não está disponível — a conexão fica pendente.
        </p>
      )}

      {provider.fields.map((field) => (
        <div key={field.key}>
          <Input
            label={field.label}
            name={field.key}
            type={field.type === "checkbox" ? "text" : field.type}
            required={field.required}
            defaultValue={field.secret ? "" : (currentConfig[field.key] ?? "")}
            placeholder={field.placeholder}
          />
          {field.secret && credentialPreviews[field.key] && (
            <p className="mt-1 text-xs text-text-tertiary">Já configurado ({credentialPreviews[field.key]}). Informe um novo valor para substituir.</p>
          )}
        </div>
      ))}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Verificando conexão..." : "Salvar e conectar"}
      </Button>
    </form>
  );
}
