"use client";

import { useActionState } from "react";
import { updateMediaMemberAction } from "@/lib/actions/media-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function MemberAccessForm({
  memberId,
  role,
  status,
  phone,
  administrativeNotes,
}: {
  memberId: string;
  role: string;
  status: string;
  phone: string | null;
  administrativeNotes: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateMediaMemberAction.bind(null, memberId), initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <FormMessage error={state.error} success={state.success} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Papel no Mídia ADESF" name="role" defaultValue={role}>
          <option value="MEMBRO">Membro</option>
          <option value="LIDER">Líder</option>
        </Select>
        <Select label="Status" name="status" defaultValue={status}>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
          <option value="SUSPENDED">Suspenso</option>
        </Select>
      </div>
      <Input label="Telefone" name="phone" defaultValue={phone ?? ""} placeholder="(11) 90000-0000" />
      <Textarea label="Notas administrativas (uso interno)" name="administrativeNotes" defaultValue={administrativeNotes ?? ""} rows={3} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar acesso"}
      </Button>
    </form>
  );
}
