"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { CAPTURE_STATUSES, CAPTURE_STATUS_LABELS } from "@/lib/validation/captures";
import {
  CAPTURE_CREW_ROLES,
  CAPTURE_CREW_ROLE_LABELS,
  CAPTURE_CREW_FORM_FIELDS,
} from "@/lib/validation/capture-assignments";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface CaptureFormValues {
  clientId: string;
  projectId: string | null;
  date: string;
  location: string | null;
  status: string;
  videomaker: string | null;
  photographer: string | null;
  storymaker: string | null;
  droneOperator: string | null;
  videoCount: number | null;
  photoCount: number | null;
  scriptNotes: string | null;
  equipment: string | null;
  videomakerUserId?: string | null;
  photographerUserId?: string | null;
  storymakerUserId?: string | null;
  droneOperatorUserId?: string | null;
}

const initialState: ActionState = {};

function toDateTimeInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

export function CaptureForm({
  action,
  defaultValues,
  clients,
  projects,
  crewAccounts,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: CaptureFormValues;
  clients: { id: string; companyName: string }[];
  projects: { id: string; name: string }[];
  crewAccounts: { userId: string; name: string; role: string }[];
  onSuccess?: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const successRef = useRef(state.success);

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

      <div className="grid grid-cols-2 gap-3">
        <Select label="Cliente" name="clientId" required defaultValue={defaultValues?.clientId ?? ""}>
          <option value="" disabled>
            Selecione um cliente
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
        <Select label="Projeto (opcional)" name="projectId" defaultValue={defaultValues?.projectId ?? ""}>
          <option value="">Sem projeto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Data e horário" name="date" type="datetime-local" required defaultValue={toDateTimeInputValue(defaultValues?.date ?? null)} />
        <Select label="Status" name="status" defaultValue={defaultValues?.status ?? "PLANEJADA"}>
          {CAPTURE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CAPTURE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <Input label="Local" name="location" defaultValue={defaultValues?.location ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Videomaker" name="videomaker" defaultValue={defaultValues?.videomaker ?? ""} />
        <Input label="Fotógrafo" name="photographer" defaultValue={defaultValues?.photographer ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Storymaker" name="storymaker" defaultValue={defaultValues?.storymaker ?? ""} />
        <Input label="Operador de drone" name="droneOperator" defaultValue={defaultValues?.droneOperator ?? ""} />
      </div>

      {crewAccounts.length > 0 && (
        <div className="rounded-[10px] border border-dashed border-border p-3">
          <p className="mb-3 text-xs font-medium text-text-secondary">
            Vincular a uma conta do sistema (opcional) — a pessoa recebe uma notificação na tela inicial dela e
            precisa aceitar ou recusar a escala.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CAPTURE_CREW_ROLES.map((role) => {
              const field = CAPTURE_CREW_FORM_FIELDS[role];
              const defaultUserId = (defaultValues as CaptureFormValues | undefined)?.[
                field.userField as keyof CaptureFormValues
              ] as string | null | undefined;
              return (
                <Select
                  key={role}
                  label={CAPTURE_CREW_ROLE_LABELS[role]}
                  name={field.userField}
                  defaultValue={defaultUserId ?? ""}
                >
                  <option value="">Não notificar</option>
                  {crewAccounts.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name} — {c.role}
                    </option>
                  ))}
                </Select>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input label="Qtd. vídeos" name="videoCount" type="number" min={0} defaultValue={defaultValues?.videoCount ?? ""} />
        <Input label="Qtd. fotos" name="photoCount" type="number" min={0} defaultValue={defaultValues?.photoCount ?? ""} />
      </div>

      <Textarea label="Roteiro / observações" name="scriptNotes" defaultValue={defaultValues?.scriptNotes ?? ""} />
      <Textarea label="Equipamentos" name="equipment" defaultValue={defaultValues?.equipment ?? ""} />

      <p className="-mt-2 text-xs text-text-tertiary">Um evento é criado automaticamente na Agenda para esta captação.</p>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
