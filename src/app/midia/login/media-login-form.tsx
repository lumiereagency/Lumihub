"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginMediaAction } from "@/lib/actions/media-auth-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function MediaLoginForm() {
  const [state, formAction, pending] = useActionState(loginMediaAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <FormMessage error={state.error} />
      <Input label="E-mail" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" />
      <Input label="Senha" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="remember" className="h-4 w-4 rounded border-border bg-card accent-[var(--lh-accent)]" />
        Lembrar sessão
      </label>
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
      <p className="text-center text-sm text-text-tertiary">
        <Link href="/esqueci-senha" className="text-accent-light hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}
