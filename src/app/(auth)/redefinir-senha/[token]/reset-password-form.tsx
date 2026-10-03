"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function ResetPasswordForm({ token, loginHref = "/login" }: { token: string; loginHref?: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="mb-1 flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">Nova senha</h1>
        <p className="text-sm text-text-tertiary">Crie a senha que você vai usar para entrar na base.</p>
      </div>
      <input type="hidden" name="token" value={token} />
      <FormMessage error={state.error} success={state.success} />
      {!state.success && (
        <>
          <Input
            label="Nova senha"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint="Mínimo de 8 caracteres, com letra e número."
          />
          <Input
            label="Confirmar nova senha"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          <Button type="submit" disabled={pending} className="mt-1 h-12 w-full">
            {pending ? "Salvando..." : "Redefinir senha"}
          </Button>
        </>
      )}
      <Link href={loginHref} className="text-center text-sm text-accent-light hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}
