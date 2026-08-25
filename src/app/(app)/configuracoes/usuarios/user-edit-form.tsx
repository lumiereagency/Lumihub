"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { updateUserAction, resendInviteAction, deleteUserAction } from "@/lib/actions/user-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { formatDateTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export interface UserEditValues {
  name: string;
  email: string;
  roleId: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export function UserEditForm({
  userId,
  defaultValues,
  roles,
  canDelete,
  isLocked = false,
  onSuccess,
}: {
  userId: string;
  defaultValues: UserEditValues;
  roles: { id: string; name: string }[];
  canDelete: boolean;
  isLocked?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateUserAction.bind(null, userId), initialState);
  const [isActive, setIsActive] = useState(defaultValues.isActive);
  const successRef = useRef(state.success);
  const [, startTransition] = useTransition();
  const [inviteSent, setInviteSent] = useState(false);

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      onSuccess?.();
    }
    successRef.current = state.success;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  if (isLocked) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-[10px] border border-border bg-bg-secondary px-3 py-2.5 text-sm text-text-secondary">
          Esta conta é protegida — só o próprio proprietário da organização pode alterá-la, ou só o proprietário pode
          alterar outro administrador.
        </p>
        <Input label="Nome" value={defaultValues.name} disabled />
        <Input label="E-mail" value={defaultValues.email} disabled />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <FormMessage error={state.error} success={state.success} />

        <Input label="Nome" name="name" required defaultValue={defaultValues.name} />
        <Input label="E-mail" value={defaultValues.email} disabled />

        <Select label="Perfil" name="roleId" defaultValue={defaultValues.roleId}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-card accent-[#E8540A]"
          />
          Usuário ativo
        </label>

        {defaultValues.lastLoginAt && (
          <p className="text-xs text-text-tertiary">Último acesso: {formatDateTime(new Date(defaultValues.lastLoginAt))}</p>
        )}

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </form>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button
          variant="secondary"
          disabled={inviteSent}
          onClick={() =>
            startTransition(async () => {
              await resendInviteAction(userId);
              setInviteSent(true);
            })
          }
        >
          {inviteSent ? "Convite reenviado" : "Reenviar convite de acesso"}
        </Button>
        {canDelete && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(`Excluir o usuário ${defaultValues.name}?`)) {
                startTransition(async () => {
                  await deleteUserAction(userId);
                  onSuccess?.();
                });
              }
            }}
          >
            Excluir usuário
          </Button>
        )}
      </div>
    </div>
  );
}
