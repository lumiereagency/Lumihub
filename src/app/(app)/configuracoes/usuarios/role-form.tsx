"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRoleAction } from "@/lib/actions/user-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { PermissionMatrix } from "./permission-matrix";

const initialState: ActionState = {};

export function RoleForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState(createRoleAction, initialState);
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
      <Input label="Nome do perfil" name="name" required placeholder="Ex: Coordenação de Projetos" />
      <p className="text-sm font-medium text-text-secondary">Permissões</p>
      <PermissionMatrix name="permissionKeys" />
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Criando..." : "Criar perfil"}
      </Button>
    </form>
  );
}
