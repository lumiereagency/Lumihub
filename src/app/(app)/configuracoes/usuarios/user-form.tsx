"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUserAction } from "@/lib/actions/user-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function UserForm({ roles, onSuccess }: { roles: { id: string; name: string }[]; onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const successRef = useRef(state.success);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      formRef.current?.reset();
      onSuccess?.();
    }
    successRef.current = state.success;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />

      <Input label="Nome" name="name" required placeholder="Nome completo" />
      <Input label="E-mail" name="email" type="email" required placeholder="pessoa@empresa.com" />

      <Select label="Perfil" name="roleId" defaultValue="">
        <option value="" disabled>
          Selecione um perfil
        </option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>

      <p className="-mt-2 text-xs text-text-tertiary">
        Um e-mail será enviado com um link para a pessoa definir a própria senha (válido por 7 dias).
      </p>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Criando..." : "Criar usuário"}
      </Button>
    </form>
  );
}
