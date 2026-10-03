"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="mb-1 flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">Esqueci minha senha</h1>
        <p className="text-sm text-text-tertiary">Informe o e-mail da sua conta. Se ele estiver cadastrado, enviamos as instruções para criar uma nova senha.</p>
      </div>
      <FormMessage error={state.error} success={state.success} />
      {!state.success && (
        <>
          <Input label="E-mail" name="email" type="email" autoComplete="email" required placeholder="voce@lumiere.com" />
          <Button type="submit" disabled={pending} className="mt-1 h-12 w-full">
            {pending ? "Enviando…" : "Enviar instruções"}
          </Button>
        </>
      )}
      <Link href="/login" className="text-center text-sm text-accent-light hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}
