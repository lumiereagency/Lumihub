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
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <p className="text-sm text-text-secondary">
        Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos instruções para
        redefinir sua senha.
      </p>
      <FormMessage error={state.error} success={state.success} />
      {!state.success && (
        <>
          <Input label="E-mail" name="email" type="email" autoComplete="email" required placeholder="voce@lumiere.com" />
          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? "Enviando..." : "Enviar instruções"}
          </Button>
        </>
      )}
      <Link href="/login" className="text-center text-sm text-gold-light hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}
