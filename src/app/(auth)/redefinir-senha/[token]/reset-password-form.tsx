"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
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
          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {pending ? "Salvando..." : "Redefinir senha"}
          </Button>
        </>
      )}
      <Link href="/login" className="text-center text-sm text-gold-light hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}
