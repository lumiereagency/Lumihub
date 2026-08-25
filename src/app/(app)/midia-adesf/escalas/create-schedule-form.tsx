"use client";

import { useActionState, useState } from "react";
import { createMonthlyScheduleAction } from "@/lib/actions/media-schedule-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Drawer } from "@/components/ui/drawer";

const initialState: ActionState = {};
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function CreateScheduleButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createMonthlyScheduleAction, initialState);
  const now = new Date();

  return (
    <>
      <Button onClick={() => setOpen(true)}>Nova escala mensal</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Nova escala mensal">
        <form action={formAction} className="flex flex-col gap-4">
          <FormMessage error={state.error} success={state.success} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Mês" name="month" defaultValue={String(now.getMonth() + 1)}>
              {MONTHS.map((label, i) => (
                <option key={i} value={i + 1}>
                  {label}
                </option>
              ))}
            </Select>
            <Select label="Ano" name="year" defaultValue={String(now.getFullYear())}>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-text-tertiary">Os cultos/eventos já cadastrados nesse período serão carregados automaticamente.</p>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Criando..." : "Criar escala"}
          </Button>
        </form>
      </Drawer>
    </>
  );
}
