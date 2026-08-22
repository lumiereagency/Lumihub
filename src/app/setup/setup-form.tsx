"use client";

import { useActionState } from "react";
import { setupOrganizationAction } from "@/lib/actions/setup-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Rio_Branco",
];

const CURRENCIES = [
  { value: "BRL", label: "Real (BRL)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

export function SetupForm() {
  const [state, formAction, pending] = useActionState(setupOrganizationAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <FormMessage error={state.error} />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
          Empresa
        </span>
        <Input label="Nome da empresa" name="companyName" required placeholder="Lumière Agency" />
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
          Administrador
        </span>
        <Input label="Seu nome" name="adminName" required placeholder="Nome completo" />
        <Input label="Seu e-mail" name="adminEmail" type="email" required placeholder="voce@lumiere.com" />
        <Input
          label="Senha"
          name="password"
          type="password"
          required
          hint="Mínimo de 8 caracteres, com letra e número."
        />
        <Input label="Confirmar senha" name="confirmPassword" type="password" required />
      </div>

      <div className="h-px bg-border" />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary" htmlFor="timezone">
            Fuso horário
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue="America/Sao_Paulo"
            className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary" htmlFor="currency">
            Moeda
          </label>
          <select
            id="currency"
            name="currency"
            defaultValue="BRL"
            className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Configurando..." : "Concluir configuração"}
      </Button>
    </form>
  );
}
