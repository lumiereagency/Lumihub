"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface PayableFormValues {
  description: string;
  supplier: string | null;
  categoryId: string | null;
  costCenterId: string | null;
  amount: number;
  dueDate: string;
  recurring: boolean;
  responsibleUserId: string | null;
}

const initialState: ActionState = {};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function PayableForm({
  action,
  defaultValues,
  categories,
  costCenters,
  users,
  showInstallments = false,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: PayableFormValues;
  categories: { id: string; name: string }[];
  costCenters: { id: string; name: string }[];
  users: { id: string; name: string }[];
  showInstallments?: boolean;
  onSuccess?: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const successRef = useRef(state.success);
  const [recurring, setRecurring] = useState(defaultValues?.recurring ?? false);
  const [installmentTotal, setInstallmentTotal] = useState("1");

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      onSuccess?.();
    }
    successRef.current = state.success;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />

      <Input label="Descrição" name="description" required defaultValue={defaultValues?.description} placeholder="Ex: Assinatura Adobe" />
      <Input label="Fornecedor (opcional)" name="supplier" defaultValue={defaultValues?.supplier ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Categoria" name="categoryId" defaultValue={defaultValues?.categoryId ?? ""}>
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Centro de custo" name="costCenterId" defaultValue={defaultValues?.costCenterId ?? ""}>
          <option value="">Sem centro de custo</option>
          {costCenters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Valor total (R$)" name="amount" type="number" min={0.01} step="0.01" required defaultValue={defaultValues?.amount} />
        <Input label="Vencimento" name="dueDate" type="date" required defaultValue={toDateInputValue(defaultValues?.dueDate ?? null)} />
      </div>

      <Select label="Responsável" name="responsibleUserId" defaultValue={defaultValues?.responsibleUserId ?? ""}>
        <option value="">Sem responsável</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>

      {showInstallments && (
        <div className="grid grid-cols-2 gap-3 items-end">
          <Input
            label="Parcelas"
            name="installmentTotal"
            type="number"
            min={1}
            max={60}
            value={installmentTotal}
            onChange={(e) => setInstallmentTotal(e.target.value)}
          />
          <p className="pb-2.5 text-xs text-text-tertiary">
            {Number(installmentTotal) > 1 ? `${installmentTotal}x de aproximadamente o valor total dividido.` : "Pagamento único."}
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          name="recurring"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          disabled={showInstallments && Number(installmentTotal) > 1}
          className="h-4 w-4 rounded border-border bg-card accent-[#E8540A]"
        />
        Recorrente (gera a próxima ocorrência automaticamente ao confirmar o pagamento)
      </label>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
