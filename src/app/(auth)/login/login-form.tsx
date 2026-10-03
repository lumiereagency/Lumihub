"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="mb-1 flex flex-col gap-1.5">
        <h1 className="text-[28px] font-semibold tracking-tight text-text-primary">Entrar</h1>
        <p className="text-sm text-text-tertiary">Use o e-mail e a senha que a Lumière cadastrou para você.</p>
      </div>
      <FormMessage error={state.error} />
      <Input label="E-mail" name="email" type="email" autoComplete="email" required placeholder="voce@lumiere.com" />
      <Input label="Senha" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-text-secondary">
          <input type="checkbox" name="remember" className="h-4 w-4 rounded border-border bg-card accent-[var(--lh-accent)]" />
          Lembrar sessão
        </label>
        <Link href="/esqueci-senha" className="text-accent-light hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Button type="submit" disabled={pending} className="mt-1 h-12 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
