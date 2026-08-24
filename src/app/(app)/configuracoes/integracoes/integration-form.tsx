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
  oauthRedirectUri,
  onSuccess,
}: {
  provider: ProviderDefinition;
  currentConfig: Record<string, string>;
  credentialPreviews: Record<string, string>;
  oauthRedirectUri?: string;
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

      {provider.oauthOnly && oauthRedirectUri && (
        <div className="rounded-[10px] border border-border bg-card p-3 text-xs text-text-secondary">
          <p className="mb-1.5">
            Antes de salvar, cadastre este Redirect URI exato no console do provedor (Google Cloud Console ou Azure
            Portal):
          </p>
          <code className="block select-all break-all rounded-[6px] bg-background px-2 py-1.5 text-accent-light">
            {oauthRedirectUri}
          </code>
        </div>
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
        {pending ? "Salvando..." : provider.oauthOnly ? "Salvar credenciais" : "Salvar e conectar"}
      </Button>

      {provider.oauthOnly && currentConfig.clientId && (
        <a
          href={`/api/integrations/oauth/${provider.key}/start`}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-card-elevated px-4 text-sm font-medium text-text-primary transition-all duration-150 hover:brightness-110"
        >
          Conectar com o provedor
        </a>
      )}
    </form>
  );
}
