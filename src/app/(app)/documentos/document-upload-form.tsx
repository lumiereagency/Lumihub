"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadDocumentAction } from "@/lib/actions/document-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS } from "@/lib/validation/documents";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function DocumentUploadForm({
  clients,
  projects,
  onSuccess,
}: {
  clients: { id: string; companyName: string }[];
  projects: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(uploadDocumentAction, initialState);
  const successRef = useRef(state.success);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      formRef.current?.reset();
      onSuccess?.();
    }
    successRef.current = state.success;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />

      <Input label="Arquivo" name="file" type="file" required />
      <Input label="Nome (opcional)" name="name" placeholder="Usa o nome do arquivo se deixado em branco" />

      <Select label="Categoria" name="category" defaultValue={DOCUMENT_CATEGORIES[0]}>
        {DOCUMENT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {DOCUMENT_CATEGORY_LABELS[c]}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Cliente (opcional)" name="clientId" defaultValue="">
          <option value="">Sem cliente vinculado</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
        <Select label="Projeto (opcional)" name="projectId" defaultValue="">
          <option value="">Sem projeto vinculado</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Enviando..." : "Enviar documento"}
      </Button>
    </form>
  );
}
