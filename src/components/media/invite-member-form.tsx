"use client";

import { useActionState } from "react";
import { inviteMediaMemberAction } from "@/lib/actions/media-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function InviteMemberForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, formAction, pending] = useActionState(inviteMediaMemberAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />
      <Input label="Nome" name="name" required />
      <Input label="E-mail" name="email" type="email" required hint="Se já existir uma conta LUMIBASE com este e-mail, ela será vinculada automaticamente." />
      <Input label="Telefone (opcional)" name="phone" placeholder="(11) 90000-0000" />
      <Select label="Papel no Mídia ADESF" name="role" defaultValue="MEMBRO" required>
        <option value="MEMBRO">Membro</option>
        <option value="LIDER">Líder</option>
      </Select>
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Enviando..." : "Convidar"}
      </Button>
      {state.success && onSuccess && (
        <Button type="button" variant="secondary" onClick={onSuccess}>
          Fechar
        </Button>
      )}
    </form>
  );
}
