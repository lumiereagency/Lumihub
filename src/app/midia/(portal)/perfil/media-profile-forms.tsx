"use client";

import { useActionState, useRef } from "react";
import { updateMyMediaProfileAction, uploadMyMediaAvatarAction } from "@/lib/actions/media-portal-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Avatar } from "@/components/ui/avatar";

const initialState: ActionState = {};

export function MediaAvatarForm({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [state, formAction, pending] = useActionState(uploadMyMediaAvatarAction, initialState);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex items-center gap-4">
      <Avatar name={name} src={avatarUrl} size="lg" />
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => e.target.form?.requestSubmit()}
        />
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? "Enviando..." : "Trocar foto"}
        </Button>
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  );
}

export function MediaProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const [state, formAction, pending] = useActionState(updateMyMediaProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <FormMessage error={state.error} success={state.success} />
      <Input label="Nome" name="name" defaultValue={name} required />
      <Input label="Telefone" name="phone" defaultValue={phone ?? ""} placeholder="(11) 90000-0000" />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
