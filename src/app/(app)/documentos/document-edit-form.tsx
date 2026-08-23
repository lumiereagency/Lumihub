"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateDocumentAction } from "@/lib/actions/document-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS } from "@/lib/validation/documents";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export interface DocumentEditValues {
  name: string;
  category: string;
  clientId: string | null;
  projectId: string | null;
}

export function DocumentEditForm({
  documentId,
  defaultValues,
  clients,
  projects,
  onSuccess,
}: {
  documentId: string;
  defaultValues: DocumentEditValues;
  clients: { id: string; companyName: string }[];
  projects: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateDocumentAction.bind(null, documentId), initialState);
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

      <Input label="Nome" name="name" required defaultValue={defaultValues.name} />

      <Select label="Categoria" name="category" defaultValue={defaultValues.category}>
        {DOCUMENT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {DOCUMENT_CATEGORY_LABELS[c]}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Cliente (opcional)" name="clientId" defaultValue={defaultValues.clientId ?? ""}>
          <option value="">Sem cliente vinculado</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
        <Select label="Projeto (opcional)" name="projectId" defaultValue={defaultValues.projectId ?? ""}>
          <option value="">Sem projeto vinculado</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
