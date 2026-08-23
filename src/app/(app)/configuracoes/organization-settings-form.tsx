"use client";

import { useActionState } from "react";
import { updateOrganizationAction } from "@/lib/actions/settings-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { TIMEZONES, TIMEZONE_LABELS, CURRENCIES, CURRENCY_LABELS, LOCALES, LOCALE_LABELS } from "@/lib/validation/settings";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: ActionState = {};

export function OrganizationSettingsForm({
  defaultValues,
}: {
  defaultValues: { name: string; timezone: string; currency: string; locale: string };
}) {
  const [state, formAction, pending] = useActionState(updateOrganizationAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferências gerais</CardTitle>
      </CardHeader>

      <form action={formAction} className="flex flex-col gap-4">
        <FormMessage error={state.error} success={state.success} />

        <Input label="Nome da organização" name="name" required defaultValue={defaultValues.name} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Fuso horário" name="timezone" defaultValue={defaultValues.timezone}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {TIMEZONE_LABELS[tz]}
              </option>
            ))}
          </Select>

          <Select label="Moeda" name="currency" defaultValue={defaultValues.currency}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>

        <Select label="Idioma" name="locale" defaultValue={defaultValues.locale}>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </Select>

        <p className="-mt-2 text-xs text-text-tertiary">
          A moeda escolhida já é usada em todos os valores exibidos no sistema. Fuso horário e idioma ficam salvos para
          uso em agendamentos e internacionalização da interface — hoje a interface do LUMIHUB é exibida apenas em
          português e as datas seguem o fuso do servidor.
        </p>

        <Button type="submit" disabled={pending} className="mt-2 w-full sm:w-auto">
          {pending ? "Salvando..." : "Salvar preferências"}
        </Button>
      </form>
    </Card>
  );
}
