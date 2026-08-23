"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { updateRolePermissionsAction, deleteRoleAction } from "@/lib/actions/user-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { PermissionMatrix } from "./permission-matrix";

const initialState: ActionState = {};

export function RoleEditForm({
  roleId,
  defaultKeys,
  canDelete,
  onSuccess,
}: {
  roleId: string;
  defaultKeys: string[];
  canDelete: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateRolePermissionsAction.bind(null, roleId), initialState);
  const successRef = useRef(state.success);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      onSuccess?.();
    }
    successRef.current = state.success;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <FormMessage error={state.error} success={state.success} />
        <PermissionMatrix name="permissionKeys" defaultKeys={defaultKeys} />
        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? "Salvando..." : "Salvar permissões"}
        </Button>
      </form>
      {canDelete && (
        <div className="border-t border-border pt-4">
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("Excluir este perfil?")) {
                startTransition(async () => {
                  await deleteRoleAction(roleId);
                  onSuccess?.();
                });
              }
            }}
          >
            Excluir perfil
          </Button>
        </div>
      )}
    </div>
  );
}
