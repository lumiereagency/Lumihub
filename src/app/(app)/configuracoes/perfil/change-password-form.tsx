"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions/profile-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />
      <Input label="Senha atual" name="currentPassword" type="password" autoComplete="current-password" required />
      <Input
        label="Nova senha"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo de 8 caracteres, com letra e número."
      />
      <Input label="Confirmar nova senha" name="confirmPassword" type="password" autoComplete="new-password" required />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Alterar senha"}
      </Button>
    </form>
  );
}
